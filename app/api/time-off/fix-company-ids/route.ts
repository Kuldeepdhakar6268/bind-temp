import { NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, isNull, or } from "drizzle-orm"

// POST /api/time-off/fix-company-ids - Fix time-off requests with missing companyId
export async function POST() {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Only allow admin/owner
    if (session.role !== "admin" && session.role !== "owner") {
      return NextResponse.json({ error: "Only admins can run this fix" }, { status: 403 })
    }

    // Find all time-off requests with null or 0 companyId
    const requestsToFix = await db
      .select({
        id: schema.timeOffRequests.id,
        employeeId: schema.timeOffRequests.employeeId,
        companyId: schema.timeOffRequests.companyId,
      })
      .from(schema.timeOffRequests)

    console.log("[fix-company-ids] Found", requestsToFix.length, "total requests")

    let fixed = 0
    const fixes: { requestId: number; oldCompanyId: number | null; newCompanyId: number }[] = []

    for (const request of requestsToFix) {
      // Get the employee to find their correct companyId
      const employee = await db.query.employees.findFirst({
        where: eq(schema.employees.id, request.employeeId),
        columns: { id: true, companyId: true, firstName: true, lastName: true },
      })

      if (!employee) {
        console.log("[fix-company-ids] Skipping request", request.id, "- employee not found")
        continue
      }

      // If companyId doesn't match, fix it
      if (request.companyId !== employee.companyId) {
        console.log("[fix-company-ids] Fixing request", request.id, "from companyId", request.companyId, "to", employee.companyId)
        
        await db
          .update(schema.timeOffRequests)
          .set({ companyId: employee.companyId })
          .where(eq(schema.timeOffRequests.id, request.id))

        fixes.push({
          requestId: request.id,
          oldCompanyId: request.companyId,
          newCompanyId: employee.companyId,
        })
        fixed++
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixed} time-off requests with incorrect companyId`,
      fixed,
      total: requestsToFix.length,
      fixes,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error fixing time-off companyIds:", error)
    return NextResponse.json({ error: "Failed to fix companyIds" }, { status: 500 })
  }
}

// GET - Check for time-off requests with mismatched companyId
export async function GET() {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Get all time-off requests with their employee's companyId
    const requests = await db
      .select({
        id: schema.timeOffRequests.id,
        employeeId: schema.timeOffRequests.employeeId,
        requestCompanyId: schema.timeOffRequests.companyId,
        employeeCompanyId: schema.employees.companyId,
        employeeName: schema.employees.firstName,
      })
      .from(schema.timeOffRequests)
      .leftJoin(schema.employees, eq(schema.timeOffRequests.employeeId, schema.employees.id))

    const mismatched = requests.filter(r => r.requestCompanyId !== r.employeeCompanyId)

    return NextResponse.json({
      total: requests.length,
      mismatched: mismatched.length,
      mismatchedRequests: mismatched,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error checking time-off companyIds:", error)
    return NextResponse.json({ error: "Failed to check companyIds" }, { status: 500 })
  }
}
