import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/service-areas/[id]
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
    const areaId = parseInt(id)

    const area = await db.query.serviceAreas.findFirst({
      where: and(
        eq(schema.serviceAreas.id, areaId),
        eq(schema.serviceAreas.companyId, session.companyId)
      ),
    })

    if (!area) {
      return NextResponse.json({ error: "Service area not found" }, { status: 404 })
    }

    return NextResponse.json(area)
  } catch (error) {
    console.error("Error fetching service area:", error)
    return NextResponse.json({ error: "Failed to fetch service area" }, { status: 500 })
  }
}

// PATCH /api/service-areas/[id]
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
    const areaId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.serviceAreas.findFirst({
      where: and(
        eq(schema.serviceAreas.id, areaId),
        eq(schema.serviceAreas.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Service area not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.postcodes !== undefined) updateData.postcodes = JSON.stringify(body.postcodes)
    if (body.city !== undefined) updateData.city = body.city
    if (body.radius !== undefined) updateData.radius = body.radius
    if (body.surchargeAmount !== undefined) updateData.surchargeAmount = body.surchargeAmount
    if (body.surchargePercent !== undefined) updateData.surchargePercent = body.surchargePercent
    if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0
    if (body.notes !== undefined) updateData.notes = body.notes

    const [updated] = await db
      .update(schema.serviceAreas)
      .set(updateData)
      .where(eq(schema.serviceAreas.id, areaId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating service area:", error)
    return NextResponse.json({ error: "Failed to update service area" }, { status: 500 })
  }
}

// DELETE /api/service-areas/[id]
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
    const areaId = parseInt(id)

    const existing = await db.query.serviceAreas.findFirst({
      where: and(
        eq(schema.serviceAreas.id, areaId),
        eq(schema.serviceAreas.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Service area not found" }, { status: 404 })
    }

    await db.delete(schema.serviceAreas).where(eq(schema.serviceAreas.id, areaId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting service area:", error)
    return NextResponse.json({ error: "Failed to delete service area" }, { status: 500 })
  }
}
