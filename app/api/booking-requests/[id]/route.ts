import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"

/**
 * GET /api/booking-requests/[id]
 * Get a specific booking request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    
    const session = await requireAuth()
    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const [result] = await db
      .select({
        request: schema.bookingRequests,
        customer: {
          id: schema.customers.id,
          firstName: schema.customers.firstName,
          lastName: schema.customers.lastName,
          email: schema.customers.email,
          phone: schema.customers.phone,
        },
      })
      .from(schema.bookingRequests)
      .leftJoin(schema.customers, eq(schema.bookingRequests.customerId, schema.customers.id))
      .where(
        and(
          eq(schema.bookingRequests.id, requestId),
          eq(schema.bookingRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...result.request,
      existingCustomer: result.customer,
    })
  } catch (error) {
    console.error("Error fetching booking request:", error)
    return NextResponse.json(
      { error: "Failed to fetch booking request" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/booking-requests/[id]
 * Update a booking request (status, add notes, quote price)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    
    const session = await requireAuth()
    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Verify request exists and belongs to company
    const [existingRequest] = await db
      .select()
      .from(schema.bookingRequests)
      .where(
        and(
          eq(schema.bookingRequests.id, requestId),
          eq(schema.bookingRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!existingRequest) {
      return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
    }

    const body = await request.json()
    const { status, adminNotes, quotedPrice, priority } = body

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    }

    if (status !== undefined) {
      updateData.status = status
      
      // Track review timestamp
      if (status === "reviewed" || status === "quoted") {
        updateData.reviewedAt = new Date()
        updateData.reviewedBy = session.id
      }
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes
    }

    if (quotedPrice !== undefined) {
      updateData.quotedPrice = quotedPrice.toString()
      updateData.status = "quoted"
      updateData.reviewedAt = new Date()
      updateData.reviewedBy = session.id
    }

    if (priority !== undefined) {
      updateData.priority = priority
    }

    const [updatedRequest] = await db
      .update(schema.bookingRequests)
      .set(updateData)
      .where(eq(schema.bookingRequests.id, requestId))
      .returning()

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error("Error updating booking request:", error)
    return NextResponse.json(
      { error: "Failed to update booking request" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/booking-requests/[id]
 * Delete a booking request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    
    const session = await requireAuth()
    const { id } = await params
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Verify request exists and belongs to company
    const [existingRequest] = await db
      .select()
      .from(schema.bookingRequests)
      .where(
        and(
          eq(schema.bookingRequests.id, requestId),
          eq(schema.bookingRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!existingRequest) {
      return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
    }

    await db
      .delete(schema.bookingRequests)
      .where(eq(schema.bookingRequests.id, requestId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting booking request:", error)
    return NextResponse.json(
      { error: "Failed to delete booking request" },
      { status: 500 }
    )
  }
}
