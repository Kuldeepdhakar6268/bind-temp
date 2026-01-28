import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { timeOffRequests } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

/**
 * GET /api/employee/time-off/[id]
 * Get a specific time-off request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const [timeOffRequest] = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.id, requestId),
          eq(timeOffRequests.employeeId, session.id)
        )
      )
      .limit(1)

    if (!timeOffRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    return NextResponse.json(timeOffRequest)
  } catch (error) {
    console.error("Error fetching time-off request:", error)
    return NextResponse.json({ error: "Failed to fetch request" }, { status: 500 })
  }
}

/**
 * PATCH /api/employee/time-off/[id]
 * Cancel a pending time-off request
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body // 'cancel'

    // Verify request belongs to employee
    const [existingRequest] = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.id, requestId),
          eq(timeOffRequests.employeeId, session.id)
        )
      )
      .limit(1)

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (action === "cancel") {
      if (existingRequest.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending requests can be cancelled" },
          { status: 400 }
        )
      }

      const [updated] = await db
        .update(timeOffRequests)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(timeOffRequests.id, requestId))
        .returning()

      return NextResponse.json({
        success: true,
        request: updated,
        message: "Request cancelled successfully",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating time-off request:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

/**
 * DELETE /api/employee/time-off/[id]
 * Delete a cancelled time-off request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Verify request belongs to employee and is cancelled
    const [existingRequest] = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.id, requestId),
          eq(timeOffRequests.employeeId, session.id)
        )
      )
      .limit(1)

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (existingRequest.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only cancelled requests can be deleted" },
        { status: 400 }
      )
    }

    await db.delete(timeOffRequests).where(eq(timeOffRequests.id, requestId))

    return NextResponse.json({
      success: true,
      message: "Request deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting time-off request:", error)
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
  }
}
