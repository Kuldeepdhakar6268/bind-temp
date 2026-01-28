import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendQuoteEmail } from "@/lib/email"
import { randomBytes } from "crypto"

// POST /api/quotes/[id]/send - Send quote email to customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const quoteId = parseInt(id)

    // Get quote with customer and items
    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.companyId, session.companyId)
      ),
      with: {
        customer: true,
        items: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    const customer = quote.customer as any
    if (!customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    // Get company info for branding
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    // Generate secure access token for public accept/reject
    const accessToken = randomBytes(32).toString("base64url")
    const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"}/quote/${quote.id}?token=${accessToken}`

    // Build customer name from firstName/lastName
    const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer" : "Customer"

    // Ensure items is an array
    const quoteItems = quote.items || []

    // Try to send email - but don't fail the entire request if it fails
    let emailSent = false
    let emailError = null
    
    try {
      await sendQuoteEmail({
        customerEmail: customer.email,
        customerName,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        items: quoteItems.map((item: any) => ({
          title: item.title || "Service",
          description: item.description,
          quantity: item.quantity || "1",
          unitPrice: item.unitPrice || "0",
          amount: item.amount || "0",
        })),
        subtotal: quote.subtotal || "0",
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discountAmount: quote.discountAmount,
        total: quote.total || "0",
        currency: quote.currency || "GBP",
        validUntil: quote.validUntil,
        notes: quote.notes,
        terms: quote.terms,
        companyName: company?.name || "Your Service Provider",
        companyLogo: company?.logo,
        viewUrl,
      })
      emailSent = true
    } catch (err) {
      console.error("Email sending failed:", err)
      emailError = err instanceof Error ? err.message : "Email service error"
    }

    // Update quote status to sent and store access token
    const [updated] = await db
      .update(schema.quotes)
      .set({
        status: "sent",
        sentAt: new Date(),
        accessToken: accessToken,
        updatedAt: new Date(),
      })
      .where(eq(schema.quotes.id, quoteId))
      .returning()

    // Return success but include warning if email failed
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Quote sent to ${customer.email}`,
        quote: updated,
      })
    } else {
      return NextResponse.json({
        success: true,
        warning: `Quote marked as sent but email delivery failed: ${emailError}. Please check your email configuration.`,
        message: `Quote status updated (email delivery failed)`,
        quote: updated,
      })
    }
  } catch (error) {
    console.error("Error sending quote:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to send quote", details: errorMessage }, { status: 500 })
  }
}
