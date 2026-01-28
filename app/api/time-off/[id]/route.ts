import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { timeOffRequests, employees } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/time-off/[id] - Get a specific time-off request (admin view)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const [timeOffRequest] = await db
      .select({
        id: timeOffRequests.id,
        type: timeOffRequests.type,
        startDate: timeOffRequests.startDate,
        endDate: timeOffRequests.endDate,
        totalDays: timeOffRequests.totalDays,
        reason: timeOffRequests.reason,
        status: timeOffRequests.status,
        reviewedBy: timeOffRequests.reviewedBy,
        reviewedAt: timeOffRequests.reviewedAt,
        reviewNotes: timeOffRequests.reviewNotes,
        createdAt: timeOffRequests.createdAt,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
        },
      })
      .from(timeOffRequests)
      .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(
        and(
          eq(timeOffRequests.id, requestId),
          eq(employees.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!timeOffRequest) {
      return NextResponse.json({ error: "Time-off request not found" }, { status: 404 })
    }

    return NextResponse.json(timeOffRequest)
  } catch (error) {
    console.error("Error fetching time-off request:", error)
    return NextResponse.json({ error: "Failed to fetch time-off request" }, { status: 500 })
  }
}

// PATCH /api/time-off/[id] - Approve or deny request (admin action)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const body = await request.json()
    const { action, reviewNotes, status: newStatus } = body

    // Verify request exists and belongs to company
    const [existing] = await db
      .select({
        id: timeOffRequests.id,
        status: timeOffRequests.status,
      })
      .from(timeOffRequests)
      .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(and(eq(timeOffRequests.id, requestId), eq(employees.companyId, session.companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Time-off request not found" }, { status: 404 })
    }

    // Handle action-based updates (approve/deny)
    if (action) {
      if (!["approve", "deny"].includes(action)) {
        return NextResponse.json(
          { error: "Invalid action. Must be 'approve' or 'deny'" },
          { status: 400 }
        )
      }

      if (existing.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending requests can be reviewed" },
          { status: 400 }
        )
      }

      const finalStatus = action === "approve" ? "approved" : "denied"

      const [updated] = await db
        .update(timeOffRequests)
        .set({
          status: finalStatus,
          reviewedBy: session.id,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(timeOffRequests.id, requestId))
        .returning()

      return NextResponse.json({
        success: true,
        request: updated,
        message: `Request ${finalStatus} successfully`,
      })
    }

    // Handle direct status updates
    if (newStatus) {
      const updateData: any = { 
        status: newStatus,
        updatedAt: new Date() 
      }
      
      if (newStatus === "approved" || newStatus === "denied") {
        updateData.reviewedBy = session.id
        updateData.reviewedAt = new Date()
        if (reviewNotes) updateData.reviewNotes = reviewNotes
      }

      const [updated] = await db
        .update(timeOffRequests)
        .set(updateData)
        .where(eq(timeOffRequests.id, requestId))
        .returning()

      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: "No action or status provided" }, { status: 400 })
  } catch (error) {
    console.error("Error updating time-off request:", error)
    return NextResponse.json({ error: "Failed to update time-off request" }, { status: 500 })
  }
}

// DELETE /api/time-off/[id] - Delete a time-off request (admin action)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Verify request exists and belongs to company
    const [existing] = await db
      .select({ id: timeOffRequests.id })
      .from(timeOffRequests)
      .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(and(eq(timeOffRequests.id, requestId), eq(employees.companyId, session.companyId)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Time-off request not found" }, { status: 404 })
    }

    await db.delete(timeOffRequests).where(eq(timeOffRequests.id, requestId))

    return NextResponse.json({ success: true, message: "Request deleted successfully" })
  } catch (error) {
    console.error("Error deleting time-off request:", error)
    return NextResponse.json({ error: "Failed to delete time-off request" }, { status: 500 })
  }
}
