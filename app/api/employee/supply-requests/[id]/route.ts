import { NextRequest, NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { supplyRequests } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * PATCH /api/employee/supply-requests/[id]
 * Cancel a supply request (employees can only cancel their own pending requests)
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

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const { id } = await params
    const requestId = parseInt(id)
    
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body

    // Get the supply request
    const existingRequest = await db.query.supplyRequests.findFirst({
      where: and(
        eq(supplyRequests.id, requestId),
        eq(supplyRequests.employeeId, session.id)
      ),
    })

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

      await db
        .update(supplyRequests)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(supplyRequests.id, requestId))

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating supply request:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

/**
 * DELETE /api/employee/supply-requests/[id]
 * Delete a cancelled supply request
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

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const { id } = await params
    const requestId = parseInt(id)
    
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Get the supply request
    const existingRequest = await db.query.supplyRequests.findFirst({
      where: and(
        eq(supplyRequests.id, requestId),
        eq(supplyRequests.employeeId, session.id)
      ),
    })

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (existingRequest.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only cancelled requests can be deleted" },
        { status: 400 }
      )
    }

    await db.delete(supplyRequests).where(eq(supplyRequests.id, requestId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting supply request:", error)
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
  }
}
