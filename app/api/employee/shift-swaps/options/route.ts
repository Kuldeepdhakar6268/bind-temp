import { NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getEmployeeSession } from "@/lib/auth"
import { and, eq, gte, lte } from "drizzle-orm"

export async function GET() {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const now = new Date()
    const end = new Date()
    end.setDate(end.getDate() + 30)

    const employees = await db.query.employees.findMany({
      where: and(eq(schema.employees.companyId, session.companyId), eq(schema.employees.status, "active")),
    })

    const jobs = await db.query.jobs.findMany({
      where: and(
        eq(schema.jobs.companyId, session.companyId),
        eq(schema.jobs.status, "scheduled"),
        gte(schema.jobs.scheduledFor, now),
        lte(schema.jobs.scheduledFor, end)
      ),
      with: {
        customer: true,
        assignee: true,
        assignments: {
          columns: {
            employeeId: true,
          },
        },
      },
    })

    return NextResponse.json({
      employees: employees.map((emp) => ({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`,
      })),
      jobs: jobs.map((job) => {
        const assignmentIds = job.assignments?.map((assignment) => assignment.employeeId) ?? []
        const assignedTo =
          assignmentIds.length === 1
            ? assignmentIds[0]
            : job.assignedTo ?? null
        return {
          id: job.id,
          title: job.title,
          scheduledFor: job.scheduledFor,
          scheduledEnd: job.scheduledEnd,
          assignedTo,
          customerName: job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "Customer",
          assigneeName: job.assignee ? `${job.assignee.firstName} ${job.assignee.lastName}` : "Unassigned",
        }
      }),
    })
  } catch (error) {
    console.error("Error fetching swap options:", error)
    return NextResponse.json({ error: "Failed to fetch swap options" }, { status: 500 })
  }
}
