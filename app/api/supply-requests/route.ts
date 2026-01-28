import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { supplyRequests, employees } from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * GET /api/supply-requests - List all supply requests for the company (admin view)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const urgency = searchParams.get("urgency")
    const employeeId = searchParams.get("employeeId")

    const conditions = [eq(supplyRequests.companyId, session.companyId)]
    
    if (status && status !== "all") {
      conditions.push(eq(supplyRequests.status, status as any))
    }
    if (urgency && urgency !== "all") {
      conditions.push(eq(supplyRequests.urgency, urgency))
    }
    if (employeeId) {
      conditions.push(eq(supplyRequests.employeeId, parseInt(employeeId)))
    }

    const requests = await db
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
      .where(and(...conditions))
      .orderBy(desc(supplyRequests.createdAt))

    // Get summary counts
    const [summaryResult] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        pending: sql<number>`COUNT(CASE WHEN ${supplyRequests.status} = 'pending' THEN 1 END)`,
        approved: sql<number>`COUNT(CASE WHEN ${supplyRequests.status} = 'approved' THEN 1 END)`,
        denied: sql<number>`COUNT(CASE WHEN ${supplyRequests.status} = 'denied' THEN 1 END)`,
        fulfilled: sql<number>`COUNT(CASE WHEN ${supplyRequests.status} = 'fulfilled' THEN 1 END)`,
        urgent: sql<number>`COUNT(CASE WHEN ${supplyRequests.urgency} IN ('high', 'urgent') AND ${supplyRequests.status} = 'pending' THEN 1 END)`,
      })
      .from(supplyRequests)
      .where(eq(supplyRequests.companyId, session.companyId))

    return NextResponse.json({
      requests,
      summary: {
        total: Number(summaryResult.total) || 0,
        pending: Number(summaryResult.pending) || 0,
        approved: Number(summaryResult.approved) || 0,
        denied: Number(summaryResult.denied) || 0,
        fulfilled: Number(summaryResult.fulfilled) || 0,
        urgent: Number(summaryResult.urgent) || 0,
      },
    })
  } catch (error) {
    console.error("Error fetching supply requests:", error)
    return NextResponse.json({ error: "Failed to fetch supply requests" }, { status: 500 })
  }
}
