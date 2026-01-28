import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/shifts/[id]
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
    const shiftId = parseInt(id)

    const shift = await db.query.shifts.findFirst({
      where: and(
        eq(schema.shifts.id, shiftId),
        eq(schema.shifts.companyId, session.companyId)
      ),
      with: {
        employee: true,
      },
    })

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 })
    }

    return NextResponse.json(shift)
  } catch (error) {
    console.error("Error fetching shift:", error)
    return NextResponse.json({ error: "Failed to fetch shift" }, { status: 500 })
  }
}

// PATCH /api/shifts/[id]
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
    const shiftId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.shifts.findFirst({
      where: and(
        eq(schema.shifts.id, shiftId),
        eq(schema.shifts.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.shiftType !== undefined) updateData.shiftType = body.shiftType
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime)
    if (body.endTime !== undefined) updateData.endTime = new Date(body.endTime)
    if (body.breakMinutes !== undefined) updateData.breakMinutes = body.breakMinutes
    if (body.status !== undefined) updateData.status = body.status
    if (body.actualStartTime !== undefined) updateData.actualStartTime = new Date(body.actualStartTime)
    if (body.actualEndTime !== undefined) updateData.actualEndTime = new Date(body.actualEndTime)
    if (body.notes !== undefined) updateData.notes = body.notes

    const [updated] = await db
      .update(schema.shifts)
      .set(updateData)
      .where(eq(schema.shifts.id, shiftId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating shift:", error)
    return NextResponse.json({ error: "Failed to update shift" }, { status: 500 })
  }
}

// DELETE /api/shifts/[id]
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
    const shiftId = parseInt(id)

    const existing = await db.query.shifts.findFirst({
      where: and(
        eq(schema.shifts.id, shiftId),
        eq(schema.shifts.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 })
    }

    await db.delete(schema.shifts).where(eq(schema.shifts.id, shiftId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting shift:", error)
    return NextResponse.json({ error: "Failed to delete shift" }, { status: 500 })
  }
}
