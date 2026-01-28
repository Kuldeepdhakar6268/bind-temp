import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/equipment/[id]
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
    const equipmentId = parseInt(id)

    const equipment = await db.query.equipment.findFirst({
      where: and(
        eq(schema.equipment.id, equipmentId),
        eq(schema.equipment.companyId, session.companyId)
      ),
      with: {
        assignedEmployee: true,
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    return NextResponse.json(equipment)
  } catch (error) {
    console.error("Error fetching equipment:", error)
    return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 })
  }
}

// PATCH /api/equipment/[id]
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
    const equipmentId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.equipment.findFirst({
      where: and(
        eq(schema.equipment.id, equipmentId),
        eq(schema.equipment.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.category !== undefined) updateData.category = body.category
    if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber
    if (body.purchaseDate !== undefined) updateData.purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null
    if (body.purchasePrice !== undefined) updateData.purchasePrice = body.purchasePrice
    if (body.warrantyExpires !== undefined) updateData.warrantyExpires = body.warrantyExpires ? new Date(body.warrantyExpires) : null
    if (body.status !== undefined) updateData.status = body.status
    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo ? parseInt(body.assignedTo) : null
    if (body.notes !== undefined) updateData.notes = body.notes

    const [updated] = await db
      .update(schema.equipment)
      .set(updateData)
      .where(eq(schema.equipment.id, equipmentId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating equipment:", error)
    return NextResponse.json({ error: "Failed to update equipment" }, { status: 500 })
  }
}

// DELETE /api/equipment/[id]
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
    const equipmentId = parseInt(id)

    const existing = await db.query.equipment.findFirst({
      where: and(
        eq(schema.equipment.id, equipmentId),
        eq(schema.equipment.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Equipment not found" }, { status: 404 })
    }

    await db.delete(schema.equipment).where(eq(schema.equipment.id, equipmentId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting equipment:", error)
    return NextResponse.json({ error: "Failed to delete equipment" }, { status: 500 })
  }
}
