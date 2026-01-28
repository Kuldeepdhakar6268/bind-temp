import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// POST /api/quotes/[id]/convert - Convert quote to job
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

    if (quote.status !== "accepted") {
      return NextResponse.json({ 
        error: "Only accepted quotes can be converted to jobs" 
      }, { status: 400 })
    }

    // Build description from quote items
    const itemsDescription = quote.items
      .map(item => `• ${item.title}${item.description ? `: ${item.description}` : ""} (${item.quantity} x £${item.unitPrice})`)
      .join("\n")

    // Create job from quote
    const [job] = await db
      .insert(schema.jobs)
      .values({
        companyId: session.companyId,
        customerId: quote.customerId,
        title: quote.title,
        description: `${quote.description || ""}\n\nItems:\n${itemsDescription}`.trim(),
        price: quote.total,
        status: "pending",
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        scheduledTime: body.scheduledTime || null,
        assigneeId: body.assigneeId || null,
        propertyId: body.propertyId || null,
        notes: quote.notes,
        priority: body.priority || "normal",
      })
      .returning()

    // Update quote to mark as converted
    await db
      .update(schema.quotes)
      .set({
        status: "converted",
        updatedAt: new Date(),
      })
      .where(eq(schema.quotes.id, quoteId))

    return NextResponse.json({
      success: true,
      message: "Quote converted to job successfully",
      job,
      quoteId: quote.id,
    }, { status: 201 })
  } catch (error) {
    console.error("Error converting quote:", error)
    return NextResponse.json({ error: "Failed to convert quote to job" }, { status: 500 })
  }
}
