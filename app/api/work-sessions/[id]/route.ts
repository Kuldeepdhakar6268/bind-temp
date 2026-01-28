import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/work-sessions/[id]
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
    const sessionId = parseInt(id)

    const workSession = await db.query.workSessions.findFirst({
      where: eq(schema.workSessions.id, sessionId),
      with: {
        employee: true,
        job: true,
      },
    })

    if (!workSession) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    // Verify employee belongs to the company
    const employee = workSession.employee
    if (!employee || Array.isArray(employee) || employee.companyId !== session.companyId) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    return NextResponse.json(workSession)
  } catch (error) {
    console.error("Error fetching work session:", error)
    return NextResponse.json({ error: "Failed to fetch work session" }, { status: 500 })
  }
}

// PATCH /api/work-sessions/[id] - Update session (clock out, edit)
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
    const sessionId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.workSessions.findFirst({
      where: eq(schema.workSessions.id, sessionId),
      with: { employee: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    // Verify employee belongs to the company
    const employee = existing.employee
    if (!employee || Array.isArray(employee) || employee.companyId !== session.companyId) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    const updateData: any = {}
    
    if (body.endedAt !== undefined) updateData.endedAt = body.endedAt ? new Date(body.endedAt) : null
    if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.startedAt !== undefined) updateData.startedAt = new Date(body.startedAt)

    const [updated] = await db
      .update(schema.workSessions)
      .set(updateData)
      .where(eq(schema.workSessions.id, sessionId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating work session:", error)
    return NextResponse.json({ error: "Failed to update work session" }, { status: 500 })
  }
}

// DELETE /api/work-sessions/[id]
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
    const sessionId = parseInt(id)

    const existing = await db.query.workSessions.findFirst({
      where: eq(schema.workSessions.id, sessionId),
      with: { employee: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    // Verify employee belongs to the company
    const employee = existing.employee
    if (!employee || Array.isArray(employee) || employee.companyId !== session.companyId) {
      return NextResponse.json({ error: "Work session not found" }, { status: 404 })
    }

    await db.delete(schema.workSessions).where(eq(schema.workSessions.id, sessionId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting work session:", error)
    return NextResponse.json({ error: "Failed to delete work session" }, { status: 500 })
  }
}
