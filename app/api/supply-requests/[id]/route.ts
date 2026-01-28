import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { supplyRequests, employees, companies } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendSupplyRequestStatusEmail } from "@/lib/supply-emails"

/**
 * GET /api/supply-requests/[id] - Get a specific supply request (admin view)
 */
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

    const [supplyRequest] = await db
      .select({
        id: supplyRequests.id,
        items: supplyRequests.items,
        urgency: supplyRequests.urgency,
        notes: supplyRequests.notes,
        neededBy: supplyRequests.neededBy,
        status: supplyRequests.status,
        reviewedBy: supplyRequests.reviewedBy,
        reviewedAt: supplyRequests.reviewedAt,
        reviewNotes: supplyRequests.reviewNotes,
        fulfilledAt: supplyRequests.fulfilledAt,
        fulfilledBy: supplyRequests.fulfilledBy,
        createdAt: supplyRequests.createdAt,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
        },
      })
      .from(supplyRequests)
      .innerJoin(employees, eq(supplyRequests.employeeId, employees.id))
      .where(
        and(
          eq(supplyRequests.id, requestId),
          eq(supplyRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!supplyRequest) {
      return NextResponse.json({ error: "Supply request not found" }, { status: 404 })
    }

    return NextResponse.json(supplyRequest)
  } catch (error) {
    console.error("Error fetching supply request:", error)
    return NextResponse.json({ error: "Failed to fetch supply request" }, { status: 500 })
  }
}

/**
 * PATCH /api/supply-requests/[id] - Approve, deny, or fulfill request (admin action)
 */
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
    const { action, reviewNotes } = body

    // Verify request exists and belongs to company
    const [existing] = await db
      .select()
      .from(supplyRequests)
      .where(
        and(
          eq(supplyRequests.id, requestId),
          eq(supplyRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Supply request not found" }, { status: 404 })
    }

    let updates: Record<string, any> = {
      updatedAt: new Date(),
    }

    switch (action) {
      case "approve":
        if (existing.status !== "pending") {
          return NextResponse.json(
            { error: "Only pending requests can be approved" },
            { status: 400 }
          )
        }
        updates = {
          ...updates,
          status: "approved",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        }
        break

      case "deny":
        if (existing.status !== "pending") {
          return NextResponse.json(
            { error: "Only pending requests can be denied" },
            { status: 400 }
          )
        }
        updates = {
          ...updates,
          status: "denied",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes || null,
        }
        break

      case "fulfill":
        if (existing.status !== "approved") {
          return NextResponse.json(
            { error: "Only approved requests can be fulfilled" },
            { status: 400 }
          )
        }
        updates = {
          ...updates,
          status: "fulfilled",
          fulfilledBy: session.userId,
          fulfilledAt: new Date(),
        }
        break

      case "reopen":
        if (!["denied", "cancelled"].includes(existing.status)) {
          return NextResponse.json(
            { error: "Only denied or cancelled requests can be reopened" },
            { status: 400 }
          )
        }
        updates = {
          ...updates,
          status: "pending",
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        }
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const [updated] = await db
      .update(supplyRequests)
      .set(updates)
      .where(eq(supplyRequests.id, requestId))
      .returning()

    if (["approve", "deny", "fulfill"].includes(action)) {
      try {
        const employee = await db.query.employees.findFirst({
          where: eq(employees.id, existing.employeeId),
        })
        const company = await db.query.companies.findFirst({
          where: eq(companies.id, session.companyId),
        })
        if (employee?.email && company) {
          let status: "approved" | "denied" | "fulfilled" = "approved"
          if (action === "deny") status = "denied"
          if (action === "fulfill") status = "fulfilled"
          let parsedItems: any[] = []
          try {
            parsedItems = JSON.parse(existing.items || "[]")
          } catch {
            parsedItems = []
          }
          await sendSupplyRequestStatusEmail({
            to: employee.email,
            companyName: company.name,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            items: parsedItems,
            status,
            reviewNotes: reviewNotes || null,
            requestId: existing.id,
          })
        }
      } catch (emailError) {
        console.error("Failed to send supply request status email:", emailError)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating supply request:", error)
    return NextResponse.json({ error: "Failed to update supply request" }, { status: 500 })
  }
}

/**
 * DELETE /api/supply-requests/[id] - Delete a supply request (admin only)
 */
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
      .select()
      .from(supplyRequests)
      .where(
        and(
          eq(supplyRequests.id, requestId),
          eq(supplyRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Supply request not found" }, { status: 404 })
    }

    await db.delete(supplyRequests).where(eq(supplyRequests.id, requestId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting supply request:", error)
    return NextResponse.json({ error: "Failed to delete supply request" }, { status: 500 })
  }
}
