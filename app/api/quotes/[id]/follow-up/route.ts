import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendQuoteFollowUp } from "@/lib/email"
import { randomBytes } from "crypto"

// POST /api/quotes/[id]/follow-up - Send follow-up email
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

    // Get quote with customer
    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.companyId, session.companyId)
      ),
      with: {
        customer: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    if (!quote.customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    if (quote.status !== "sent" && quote.status !== "pending") {
      return NextResponse.json({ 
        error: "Can only follow up on sent or pending quotes" 
      }, { status: 400 })
    }

    // Get company info
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    // Generate cryptographically secure view token
    const viewToken = randomBytes(32).toString("base64url")
    
    // Store the access token in the database for validation
    await db
      .update(schema.quotes)
      .set({ accessToken: viewToken })
      .where(eq(schema.quotes.id, quoteId))
    
    const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"}/quote/${quote.id}?token=${viewToken}`

    // Send follow-up email
    const customer = quote.customer as any
    await sendQuoteFollowUp({
      customerEmail: customer.email,
      customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer",
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      total: quote.total || "0",
      currency: quote.currency || "GBP",
      validUntil: quote.validUntil,
      companyName: company?.name || "Your Service Provider",
      viewUrl,
    })

    // Update quote notes with follow-up timestamp
    const followUpNote = `Follow-up sent: ${new Date().toLocaleString()}`
    await db
      .update(schema.quotes)
      .set({
        notes: quote.notes ? `${quote.notes}\n\n${followUpNote}` : followUpNote,
        updatedAt: new Date(),
      })
      .where(eq(schema.quotes.id, quoteId))

    return NextResponse.json({
      success: true,
      message: `Follow-up email sent to ${customer.email}`,
    })
  } catch (error) {
    console.error("Error sending follow-up:", error)
    return NextResponse.json({ error: "Failed to send follow-up" }, { status: 500 })
  }
}
