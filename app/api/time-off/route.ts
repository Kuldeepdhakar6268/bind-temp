import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { timeOffRequests, employees } from "@/lib/db/schema"
import { eq, and, desc, gte, lte, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/time-off - List time-off requests (admin view)
export async function GET(request: NextRequest) {
  let debug = false
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[time-off GET] Session companyId:", session.companyId, "userId:", session.id)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const employeeId = searchParams.get("employeeId")
    const requestType = searchParams.get("type")
    debug = searchParams.get("debug") === "1"

    // First, let's check what's in the database for debugging
    const allTimeOffRequests = await db
      .select({
        id: timeOffRequests.id,
        companyId: timeOffRequests.companyId,
        employeeId: timeOffRequests.employeeId,
        status: timeOffRequests.status,
      })
      .from(timeOffRequests)
    
    console.log("[time-off GET] All time-off requests in DB:", allTimeOffRequests.length)
    console.log("[time-off GET] Requests by companyId:", allTimeOffRequests.map(r => ({ id: r.id, companyId: r.companyId })))

    // Also check employees for this company
    const companyEmployees = await db
      .select({ id: employees.id, firstName: employees.firstName, companyId: employees.companyId })
      .from(employees)
      .where(eq(employees.companyId, session.companyId))
    
    console.log("[time-off GET] Employees for companyId", session.companyId, ":", companyEmployees.map(e => ({ id: e.id, name: e.firstName })))

    // Scope by employee's company to avoid relying on potentially stale request.companyId
    const conditions = [eq(employees.companyId, session.companyId)]
    
    if (status && status !== "all") {
      conditions.push(eq(timeOffRequests.status, status as any))
    }
    if (employeeId) {
      conditions.push(eq(timeOffRequests.employeeId, parseInt(employeeId)))
    }
    if (requestType) {
      conditions.push(eq(timeOffRequests.type, requestType))
    }

    const requests = await db
      .select({
        id: timeOffRequests.id,
        employeeId: timeOffRequests.employeeId,
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
        companyId: timeOffRequests.companyId,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
        },
      })
      .from(timeOffRequests)
      .leftJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(timeOffRequests.createdAt))

    console.log("[time-off GET] Found", requests.length, "requests for companyId:", session.companyId)

    let debugInfo: Record<string, unknown> | undefined
    if (debug) {
      try {
        const companyScopedRequests = await db
          .select({
            id: timeOffRequests.id,
            employeeId: timeOffRequests.employeeId,
            status: timeOffRequests.status,
          })
          .from(timeOffRequests)
          .leftJoin(employees, eq(timeOffRequests.employeeId, employees.id))
          .where(eq(employees.companyId, session.companyId))
          .orderBy(desc(timeOffRequests.createdAt))

        debugInfo = {
          sessionCompanyId: session.companyId,
          employeeCount: companyEmployees.length,
          totalRequestsInDb: allTimeOffRequests.length,
          totalRequestsForCompany: companyScopedRequests.length,
          latestRequestForCompany: companyScopedRequests[0] || null,
        }
      } catch (debugError) {
        console.error("[time-off GET] Debug block failed:", debugError)
        debugInfo = {
          sessionCompanyId: session.companyId,
          employeeCount: companyEmployees.length,
          totalRequestsInDb: allTimeOffRequests.length,
          debugError: debugError instanceof Error ? debugError.message : String(debugError),
        }
      }
    }

    // Get summary counts
    const year = new Date().getFullYear()
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)
    const yearStartIso = yearStart.toISOString()
    const yearEndIso = yearEnd.toISOString()

    const [summaryResult] = await db
      .select({
        pendingCount: sql<number>`COUNT(CASE WHEN ${timeOffRequests.status} = 'pending' THEN 1 END)`,
        approvedCount: sql<number>`COUNT(CASE WHEN ${timeOffRequests.status} = 'approved' THEN 1 END)`,
        deniedCount: sql<number>`COUNT(CASE WHEN ${timeOffRequests.status} = 'denied' THEN 1 END)`,
        totalDaysApproved: sql<number>`COALESCE(SUM(CASE WHEN ${timeOffRequests.status} = 'approved' AND ${timeOffRequests.startDate} >= ${yearStartIso} AND ${timeOffRequests.endDate} <= ${yearEndIso} THEN ${timeOffRequests.totalDays}::numeric ELSE 0 END), 0)`,
      })
      .from(timeOffRequests)
      .leftJoin(employees, eq(timeOffRequests.employeeId, employees.id))
      .where(eq(employees.companyId, session.companyId))

    return NextResponse.json({
      requests,
      summary: {
        pendingCount: Number(summaryResult.pendingCount) || 0,
        approvedCount: Number(summaryResult.approvedCount) || 0,
        deniedCount: Number(summaryResult.deniedCount) || 0,
        totalDaysApproved: Number(summaryResult.totalDaysApproved) || 0,
      },
      ...(debugInfo ? { debug: debugInfo } : {}),
    })
  } catch (error) {
    console.error("Error fetching time-off requests:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch time-off requests"
    return NextResponse.json(
      debug ? { error: message, debugError: message } : { error: "Failed to fetch time-off requests" },
      { status: 500 }
    )
  }
}

// POST /api/time-off - Disabled: employees must submit their own requests
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Managers cannot create time-off requests. Employees must submit their own requests." },
      { status: 403 }
    )
  } catch (error) {
    console.error("Error creating time-off request:", error)
    return NextResponse.json({ error: "Failed to create time-off request" }, { status: 500 })
  }
}

