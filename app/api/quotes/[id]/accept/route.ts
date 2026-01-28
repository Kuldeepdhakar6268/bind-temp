import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { sendQuoteAcceptedNotification } from "@/lib/email"

// POST /api/quotes/[id]/accept - Customer accepts a quote (public endpoint)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { id } = await params
    const quoteId = parseInt(id)
    const body = await request.json().catch(() => ({}))

    // Validate token (required for security)
    const token = body.token || request.headers.get("x-quote-token")
    if (!token) {
      return NextResponse.json({ error: "Access token is required" }, { status: 401 })
    }

    // Get quote
    const quote = await db.query.quotes.findFirst({
      where: eq(schema.quotes.id, quoteId),
      with: {
        customer: true,
      },
    })

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Validate token matches
    if (!quote.accessToken || quote.accessToken !== token) {
      return NextResponse.json({ error: "Invalid access token" }, { status: 403 })
    }

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Check if quote is still valid
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return NextResponse.json({ error: "Quote has expired" }, { status: 400 })
    }

    if (quote.status === "accepted") {
      return NextResponse.json({ error: "Quote already accepted" }, { status: 400 })
    }

    if (quote.status === "rejected") {
      return NextResponse.json({ error: "Quote was rejected" }, { status: 400 })
    }

    // Update quote status
    const [updated] = await db
      .update(schema.quotes)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.quotes.id, quoteId))
      .returning()

    // Get company to send notification
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, quote.companyId),
    })

    // Send notification to company
    if (company?.email && isCompanyNotificationEnabled(company.notificationSettings, "quoteUpdates")) {
      const customer = quote.customer as any
      await sendQuoteAcceptedNotification({
        companyEmail: company.email,
        companyName: company.name,
        customerName: customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer" : "Customer",
        quoteNumber: quote.quoteNumber,
        quoteTitle: quote.title,
        total: quote.total || "0",
        currency: quote.currency || "GBP",
      }).catch(err => console.error("Failed to send acceptance notification:", err))
    }

    return NextResponse.json({
      success: true,
      message: "Quote accepted successfully",
      quote: updated,
    })
  } catch (error) {
    console.error("Error accepting quote:", error)
    return NextResponse.json({ error: "Failed to accept quote" }, { status: 500 })
  }
}
