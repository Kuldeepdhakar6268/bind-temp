import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobCheckIns, employees, jobs } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * GET /api/check-ins
 * Get recent check-ins for the company
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const type = searchParams.get("type") // check_in or check_out

    const conditions = [eq(jobCheckIns.companyId, session.companyId)]
    
    if (type === "check_in" || type === "check_out") {
      conditions.push(eq(jobCheckIns.type, type))
    }

    const checkIns = await db
      .select({
        id: jobCheckIns.id,
        type: jobCheckIns.type,
        checkedAt: jobCheckIns.checkedAt,
        gpsLatitude: jobCheckIns.gpsLatitude,
        gpsLongitude: jobCheckIns.gpsLongitude,
        gpsAccuracy: jobCheckIns.gpsAccuracy,
        employeeId: jobCheckIns.employeeId,
        jobId: jobCheckIns.jobId,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
        },
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
        },
      })
      .from(jobCheckIns)
      .leftJoin(employees, eq(jobCheckIns.employeeId, employees.id))
      .leftJoin(jobs, eq(jobCheckIns.jobId, jobs.id))
      .where(and(...conditions))
      .orderBy(desc(jobCheckIns.checkedAt))
      .limit(limit)

    return NextResponse.json(checkIns)
  } catch (error) {
    console.error("Error fetching check-ins:", error)
    return NextResponse.json({ error: "Failed to fetch check-ins" }, { status: 500 })
  }
}
