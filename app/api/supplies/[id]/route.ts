import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/supplies/[id] - Get single supply item
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

    const supply = await db.query.supplies.findFirst({
      where: and(
        eq(schema.supplies.id, parseInt(id)),
        eq(schema.supplies.companyId, session.companyId)
      ),
    })

    if (!supply) {
      return NextResponse.json({ error: "Supply not found" }, { status: 404 })
    }

    return NextResponse.json(supply)
  } catch (error) {
    console.error("Error fetching supply:", error)
    return NextResponse.json({ error: "Failed to fetch supply" }, { status: 500 })
  }
}

// PATCH /api/supplies/[id] - Update supply item
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
    const supplyId = parseInt(id)
    const body = await request.json()

    // Check supply exists and belongs to company
    const existing = await db.query.supplies.findFirst({
      where: and(
        eq(schema.supplies.id, supplyId),
        eq(schema.supplies.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Supply not found" }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, any> = { updatedAt: new Date() }

    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.category !== undefined) updates.category = body.category
    if (body.sku !== undefined) updates.sku = body.sku
    if (body.unit !== undefined) updates.unit = body.unit
    if (body.notes !== undefined) updates.notes = body.notes

    if (body.quantity !== undefined) {
      const parsedQty = Number(body.quantity)
      updates.quantity = Number.isFinite(parsedQty) ? Math.max(0, parsedQty) : existing.quantity
    }

    if (body.minQuantity !== undefined) {
      const parsedMinQty = Number(body.minQuantity)
      updates.minQuantity = Number.isFinite(parsedMinQty) ? Math.max(0, parsedMinQty) : existing.minQuantity
    }

    if (body.unitCost !== undefined) {
      updates.unitCost =
        typeof body.unitCost === "string" && body.unitCost.trim() === "" ? null : body.unitCost ?? null
    }

    if (body.supplier !== undefined) {
      updates.supplier =
        typeof body.supplier === "string" && body.supplier.trim() === "" ? null : body.supplier ?? null
    }

    // Auto-update status based on the next quantity/minQuantity
    if (body.quantity !== undefined || body.minQuantity !== undefined) {
      const nextQty = updates.quantity ?? existing.quantity ?? 0
      const nextMinQty = updates.minQuantity ?? existing.minQuantity ?? 5
      if (nextQty === 0) {
        updates.status = "out-of-stock"
      } else if (nextQty <= nextMinQty) {
        updates.status = "low-stock"
      } else {
        updates.status = "in-stock"
      }
    }

    const [updated] = await db
      .update(schema.supplies)
      .set(updates)
      .where(eq(schema.supplies.id, supplyId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating supply:", error)
    return NextResponse.json({ error: "Failed to update supply" }, { status: 500 })
  }
}

// DELETE /api/supplies/[id] - Delete supply item
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

    // Check supply exists and belongs to company
    const existing = await db.query.supplies.findFirst({
      where: and(
        eq(schema.supplies.id, parseInt(id)),
        eq(schema.supplies.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Supply not found" }, { status: 404 })
    }

    await db.delete(schema.supplies).where(eq(schema.supplies.id, parseInt(id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting supply:", error)
    return NextResponse.json({ error: "Failed to delete supply" }, { status: 500 })
  }
}
