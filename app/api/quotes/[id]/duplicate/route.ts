import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// POST /api/quotes/[id]/duplicate - Duplicate a quote
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
    const body = await request.json().catch(() => ({}))

    // Get original quote with items
    const original = await db.query.quotes.findFirst({
      where: and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.companyId, session.companyId)
      ),
      with: {
        items: true,
      },
    })

    if (!original) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Generate new quote number
    const existingQuotes = await db.query.quotes.findMany({
      where: eq(schema.quotes.companyId, session.companyId),
    })
    const quoteNumber = `Q-${new Date().getFullYear()}-${String(existingQuotes.length + 1).padStart(4, "0")}`

    // Create duplicate
    const [newQuote] = await db
      .insert(schema.quotes)
      .values({
        companyId: session.companyId,
        customerId: body.customerId || original.customerId,
        quoteNumber,
        title: body.title || `${original.title} (Copy)`,
        description: original.description,
        subtotal: original.subtotal,
        taxRate: original.taxRate,
        taxAmount: original.taxAmount,
        discountAmount: original.discountAmount,
        total: original.total,
        currency: original.currency,
        status: "draft",
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: original.notes,
        terms: original.terms,
      })
      .returning()

    // Duplicate items
    if (original.items.length > 0) {
      await db.insert(schema.quoteItems).values(
        original.items.map((item, index) => ({
          quoteId: newQuote.id,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: index,
        }))
      )
    }

    // Get complete quote with items
    const complete = await db.query.quotes.findFirst({
      where: eq(schema.quotes.id, newQuote.id),
      with: {
        customer: true,
        items: true,
      },
    })

    return NextResponse.json(complete, { status: 201 })
  } catch (error) {
    console.error("Error duplicating quote:", error)
    return NextResponse.json({ error: "Failed to duplicate quote" }, { status: 500 })
  }
}
