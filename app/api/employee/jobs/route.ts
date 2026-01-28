import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, customers, cleaningPlans, employees, jobAssignments } from "@/lib/db/schema"
import { eq, and, gte, lte, desc, sql, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

// GET /api/employee/jobs - Get jobs assigned to the current employee
export async function GET(request: NextRequest) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filter = searchParams.get("filter") // today, week, month, custom, all
    const startParam = searchParams.get("start")
    const endParam = searchParams.get("end")

    // Build base conditions
    let conditions = [
      eq(jobAssignments.employeeId, session.id),
      eq(jobAssignments.companyId, session.companyId),
      ne(jobAssignments.status, "declined"),
    ]

    const upcomingMonths = 1

    // Apply filters
    if (filter === "today") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      conditions.push(gte(jobs.scheduledFor, today))
      conditions.push(lte(jobs.scheduledFor, tomorrow))
    } else if (filter === "week") {
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setHours(0, 0, 0, 0)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 7)
      endOfWeek.setMilliseconds(endOfWeek.getMilliseconds() - 1)

      conditions.push(gte(jobs.scheduledFor, startOfWeek))
      conditions.push(lte(jobs.scheduledFor, endOfWeek))
    } else if (filter === "month") {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(today.getFullYear(), today.getMonth() + upcomingMonths, 1)
      endDate.setMilliseconds(endDate.getMilliseconds() - 1)

      conditions.push(gte(jobs.scheduledFor, startDate))
      conditions.push(lte(jobs.scheduledFor, endDate))
    } else if (filter === "custom" && startParam && endParam) {
      const startDate = new Date(startParam)
      const endDate = new Date(endParam)
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(23, 59, 59, 999)
        conditions.push(gte(jobs.scheduledFor, startDate))
        conditions.push(lte(jobs.scheduledFor, endDate))
      }
    }

    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id),
      columns: {
        payType: true,
        hourlyRate: true,
      },
    })
    const employeePayType = employee?.payType || "hourly"
    const hourlyRate = employee?.hourlyRate ? parseFloat(employee.hourlyRate) : 0

    const computeHourlyPay = (job: typeof jobs.$inferSelect) => {
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null
      let minutes = job.durationMinutes ?? null
      if (!minutes && job.scheduledFor && job.scheduledEnd) {
        const start = new Date(job.scheduledFor).getTime()
        const end = new Date(job.scheduledEnd).getTime()
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          minutes = Math.round((end - start) / 60000)
        }
      }
      if (!minutes || minutes <= 0) return null
      const pay = hourlyRate * (minutes / 60)
      return Number.isFinite(pay) && pay > 0 ? pay.toFixed(2) : null
    }

    const results = await db
      .select({
        job: jobs,
        assignment: jobAssignments,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
        },
        plan: {
          estimatedDuration: cleaningPlans.estimatedDuration,
          price: cleaningPlans.price,
        },
        tasksTotal: sql<number>`(select count(*) from job_tasks where job_id = ${jobs.id})`,
        tasksCompleted: sql<number>`(select count(*) from job_tasks where job_id = ${jobs.id} and status = 'completed')`,
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(cleaningPlans, eq(jobs.planId, cleaningPlans.id))
      .where(and(...conditions))
      .orderBy(desc(jobs.scheduledFor))

    const transformedResults = results.map((r) => {
      let resolvedPay = r.assignment?.payAmount ?? r.job.employeePay ?? null
      if (employeePayType === "hourly" && !resolvedPay) {
        resolvedPay = computeHourlyPay(r.job)
      }
      if (employeePayType === "salary") {
        resolvedPay = null
      }
      return {
        ...r.job,
        employeePay: resolvedPay,
      employeeAccepted: r.assignment?.status === "accepted" ? 1 : 0,
      planEstimatedDuration: r.plan?.estimatedDuration || null,
      planPrice: r.plan?.price || null,
      tasksTotal: Number(r.tasksTotal || 0),
      tasksCompleted: Number(r.tasksCompleted || 0),
      employeePayType,
      customer: r.customer ? {
        id: r.customer.id,
        name: `${r.customer.firstName} ${r.customer.lastName}`,
        firstName: r.customer.firstName,
        lastName: r.customer.lastName,
      } : null,
      }
    })

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error("Error fetching employee jobs:", error)
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    )
  }
}


