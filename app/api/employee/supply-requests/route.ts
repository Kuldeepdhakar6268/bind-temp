import { NextRequest, NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { supplyRequests, employees, companies } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { sendSupplyRequestCreatedEmail } from "@/lib/supply-emails"

/**
 * GET /api/employee/supply-requests
 * Get all supply requests for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    // Build query conditions
    const conditions = [eq(supplyRequests.employeeId, session.id)]
    if (status && status !== "all") {
      conditions.push(eq(supplyRequests.status, status))
    }

    const requests = await db.query.supplyRequests.findMany({
      where: and(...conditions),
      orderBy: desc(supplyRequests.createdAt),
    })

    // Get counts by status
    const allRequests = await db.query.supplyRequests.findMany({
      where: eq(supplyRequests.employeeId, session.id),
    })

    const summary = {
      total: allRequests.length,
      pending: allRequests.filter(r => r.status === "pending").length,
      approved: allRequests.filter(r => r.status === "approved").length,
      denied: allRequests.filter(r => r.status === "denied").length,
      fulfilled: allRequests.filter(r => r.status === "fulfilled").length,
    }

    return NextResponse.json({ requests, summary })
  } catch (error) {
    console.error("Error fetching supply requests:", error)
    return NextResponse.json({ error: "Failed to fetch supply requests" }, { status: 500 })
  }
}

/**
 * POST /api/employee/supply-requests
 * Create a new supply request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const body = await request.json()
    const { items, urgency, notes, neededBy } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 })
    }

    // Get employee's company
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id),
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Create supply request
    const [newRequest] = await db
      .insert(supplyRequests)
      .values({
        companyId: employee.companyId,
        employeeId: session.id,
        items: JSON.stringify(items),
        urgency: urgency || "normal",
        notes: notes || null,
        neededBy: neededBy ? new Date(neededBy) : null,
        status: "pending",
      })
      .returning()

    try {
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, employee.companyId),
      })
      if (company?.email) {
        await sendSupplyRequestCreatedEmail({
          to: company.email,
          companyName: company.name,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          items,
          urgency: urgency || "normal",
          neededBy: neededBy ? new Date(neededBy) : null,
          notes: notes || null,
          requestId: newRequest.id,
        })
      }
    } catch (emailError) {
      console.error("Failed to send supply request email:", emailError)
    }

    return NextResponse.json(newRequest, { status: 201 })
  } catch (error) {
    console.error("Error creating supply request:", error)
    return NextResponse.json({ error: "Failed to create supply request" }, { status: 500 })
  }
}
