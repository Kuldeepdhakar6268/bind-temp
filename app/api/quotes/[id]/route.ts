import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/quotes/[id] - Get a single quote
export async function GET(
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

    return NextResponse.json(quote)
  } catch (error) {
    console.error("Error fetching quote:", error)
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}

// PATCH /api/quotes/[id] - Update a quote
export async function PATCH(
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
    const body = await request.json()

    // Verify quote belongs to company
    const existing = await db.query.quotes.findFirst({
      where: and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil)
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.terms !== undefined) updateData.terms = body.terms
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal.toString()
    if (body.taxRate !== undefined) updateData.taxRate = body.taxRate.toString()
    if (body.taxAmount !== undefined) updateData.taxAmount = body.taxAmount.toString()
    if (body.discountAmount !== undefined) updateData.discountAmount = body.discountAmount.toString()
    if (body.total !== undefined) updateData.total = body.total.toString()
    
    // Handle status changes
    if (body.status === "sent" && !existing.sentAt) {
      updateData.sentAt = new Date()
    }
    if (body.status === "accepted" && !existing.acceptedAt) {
      updateData.acceptedAt = new Date()
    }
    if (body.status === "rejected" && !existing.rejectedAt) {
      updateData.rejectedAt = new Date()
    }

    const [updated] = await db
      .update(schema.quotes)
      .set(updateData)
      .where(eq(schema.quotes.id, quoteId))
      .returning()

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await db.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quoteId))
      
      // Insert new items
      if (body.items.length > 0) {
        await db.insert(schema.quoteItems).values(
          body.items.map((item: any, index: number) => ({
            quoteId: quoteId,
            title: item.title,
            description: item.description,
            quantity: item.quantity?.toString() || "1",
            unitPrice: item.unitPrice?.toString() || "0",
            amount: item.amount?.toString() || "0",
            sortOrder: index,
          }))
        )
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating quote:", error)
    return NextResponse.json({ error: "Failed to update quote" }, { status: 500 })
  }
}

// DELETE /api/quotes/[id] - Delete a quote
export async function DELETE(
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

    // Verify quote belongs to company
    const existing = await db.query.quotes.findFirst({
      where: and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    await db.delete(schema.quotes).where(eq(schema.quotes.id, quoteId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting quote:", error)
    return NextResponse.json({ error: "Failed to delete quote" }, { status: 500 })
  }
}
