import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { timeOffRequests, employees } from "@/lib/db/schema"
import { eq, and, desc, gte } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

/**
 * GET /api/employee/time-off
 * Get all time-off requests for the logged-in employee
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // pending, approved, denied, all

    let conditions = [eq(timeOffRequests.employeeId, session.id)]

    if (status && status !== "all") {
      conditions.push(eq(timeOffRequests.status, status))
    }

    const requests = await db
      .select()
      .from(timeOffRequests)
      .where(and(...conditions))
      .orderBy(desc(timeOffRequests.createdAt))

    // Calculate summary stats
    const allRequests = await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.employeeId, session.id))

    const pendingCount = allRequests.filter(r => r.status === "pending").length
    const approvedCount = allRequests.filter(r => r.status === "approved").length
    const deniedCount = allRequests.filter(r => r.status === "denied").length

    // Calculate days used this year
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const approvedThisYear = allRequests.filter(
      r => r.status === "approved" && new Date(r.startDate) >= yearStart
    )
    const daysUsedThisYear = approvedThisYear.reduce(
      (sum, r) => sum + parseFloat(r.totalDays || "0"),
      0
    )

    return NextResponse.json({
      requests,
      summary: {
        pendingCount,
        approvedCount,
        deniedCount,
        daysUsedThisYear,
      },
    })
  } catch (error) {
    console.error("Error fetching time-off requests:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}

/**
 * POST /api/employee/time-off
 * Create a new time-off request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, startDate, endDate, reason } = body

    if (!type || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Type, start date, and end date are required" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      )
    }

    // Calculate total days (excluding weekends for simplicity)
    let totalDays = 0
    const current = new Date(start)
    while (current <= end) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totalDays++
      }
      current.setDate(current.getDate() + 1)
    }

    // Check for overlapping requests
    const existingRequests = await db
      .select()
      .from(timeOffRequests)
      .where(
        and(
          eq(timeOffRequests.employeeId, session.id),
          eq(timeOffRequests.status, "pending")
        )
      )

    const hasOverlap = existingRequests.some(req => {
      const reqStart = new Date(req.startDate)
      const reqEnd = new Date(req.endDate)
      return (start <= reqEnd && end >= reqStart)
    })

    if (hasOverlap) {
      return NextResponse.json(
        { error: "You already have a pending request for overlapping dates" },
        { status: 400 }
      )
    }

    // Create the request
    // Get employee to ensure we have the correct companyId from the database
    const employee = await db
      .select()
      .from(employees)
      .where(eq(employees.id, session.id))
      .limit(1)

    if (!employee.length) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const companyId = employee[0].companyId
    console.log("[employee time-off POST] Creating request with companyId:", companyId, "employeeId:", session.id)
    
    const [newRequest] = await db
      .insert(timeOffRequests)
      .values({
        companyId: companyId,
        employeeId: session.id,
        type,
        startDate: start,
        endDate: end,
        totalDays: totalDays.toString(),
        reason: reason || null,
        status: "pending",
      })
      .returning()

    console.log("[employee time-off POST] Created request:", newRequest.id, "for companyId:", newRequest.companyId)

    return NextResponse.json({
      success: true,
      request: newRequest,
      message: "Time-off request submitted successfully!",
    })
  } catch (error) {
    console.error("Error creating time-off request:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create request" },
      { status: 500 }
    )
  }
}
