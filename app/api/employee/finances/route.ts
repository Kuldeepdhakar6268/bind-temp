import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, employees, employeePayouts, customers, cleaningPlans, jobAssignments } from "@/lib/db/schema"
import { eq, and, gte, lte, desc, sql, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

/**
 * GET /api/employee/finances
 * Get financial overview for the logged-in employee
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const periodStart = searchParams.get("periodStart")
    const periodEnd = searchParams.get("periodEnd")

    // Default to current week if no dates provided
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday
    endOfWeek.setHours(23, 59, 59, 999)

    const startDate = periodStart ? new Date(periodStart) : startOfWeek
    const endDate = periodEnd ? new Date(periodEnd) : endOfWeek

    // Get employee details including hourly rate
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id)
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const hourlyRate = parseFloat(employee.hourlyRate || "0")
    const currency = "GBP"

    // Get all completed jobs for this employee in the period
    const completedJobs = await db
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
        },
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(cleaningPlans, eq(jobs.planId, cleaningPlans.id))
      .where(
        and(
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, startDate),
          lte(jobs.completedAt, endDate)
        )
      )
      .orderBy(desc(jobs.completedAt))

    // Get scheduled jobs for the period (upcoming earnings)
    const scheduledJobs = await db
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
        },
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(cleaningPlans, eq(jobs.planId, cleaningPlans.id))
      .where(
        and(
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
          sql`${jobs.status} IN ('scheduled', 'in_progress')`,
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
      .orderBy(jobs.scheduledFor)

    // Get all payouts for this employee
    const payouts = await db
      .select()
      .from(employeePayouts)
      .where(eq(employeePayouts.employeeId, session.id))
      .orderBy(desc(employeePayouts.createdAt))
      .limit(20)

    // Calculate earnings from completed jobs
    const completedEarnings = completedJobs.reduce((total, { job, assignment }) => {
      // Use assignment pay if available, otherwise job pricing, otherwise hourly rate
      const assignmentPay = assignment?.payAmount ? parseFloat(assignment.payAmount) : 0
      if (assignmentPay > 0) return total + assignmentPay

      const price = parseFloat(job.actualPrice || job.estimatedPrice || "0")
      if (price > 0) return total + price

      const durationHours = (job.durationMinutes || 60) / 60
      return total + (durationHours * hourlyRate)
    }, 0)

    // Calculate estimated earnings from scheduled jobs
    const scheduledEarnings = scheduledJobs.reduce((total, { job, assignment }) => {
      const assignmentPay = assignment?.payAmount ? parseFloat(assignment.payAmount) : 0
      if (assignmentPay > 0) return total + assignmentPay

      const price = parseFloat(job.estimatedPrice || "0")
      if (price > 0) return total + price

      const durationHours = (job.durationMinutes || 60) / 60
      return total + (durationHours * hourlyRate)
    }, 0)

    // Calculate total hours worked in the period
    const getPlanMinutes = (estimatedDuration: string | null | undefined) => {
      const minutes = estimatedDuration ? Number(estimatedDuration) : NaN
      return Number.isFinite(minutes) && minutes > 0 ? minutes : null
    }

    const totalHoursWorked = completedJobs.reduce((total, { job, plan }) => {
      const planMinutes = getPlanMinutes(plan?.estimatedDuration)
      return total + (((planMinutes ?? job.durationMinutes ?? 60) as number) / 60)
    }, 0)

    // Calculate paid vs outstanding from completed jobs
    // Get all payout job IDs
    const paidJobIds = new Set<number>()
    payouts.forEach(payout => {
      if (payout.jobIds) {
        try {
          const ids = JSON.parse(payout.jobIds)
          if (Array.isArray(ids)) {
            ids.forEach(id => paidJobIds.add(id))
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    })

    // Separate completed jobs into paid and outstanding
    const paidJobs = completedJobs.filter(({ job }) => paidJobIds.has(job.id))
    const outstandingJobs = completedJobs.filter(({ job }) => !paidJobIds.has(job.id))

    const paidAmount = paidJobs.reduce((total, { job, assignment }) => {
      const assignmentPay = assignment?.payAmount ? parseFloat(assignment.payAmount) : 0
      if (assignmentPay > 0) return total + assignmentPay
      const price = parseFloat(job.actualPrice || job.estimatedPrice || "0")
      if (price > 0) return total + price
      const durationHours = (job.durationMinutes || 60) / 60
      return total + (durationHours * hourlyRate)
    }, 0)

    const outstandingAmount = outstandingJobs.reduce((total, { job, assignment }) => {
      const assignmentPay = assignment?.payAmount ? parseFloat(assignment.payAmount) : 0
      if (assignmentPay > 0) return total + assignmentPay
      const price = parseFloat(job.actualPrice || job.estimatedPrice || "0")
      if (price > 0) return total + price
      const durationHours = (job.durationMinutes || 60) / 60
      return total + (durationHours * hourlyRate)
    }, 0)

    // Get lifetime stats
    const allTimeCompleted = await db
      .select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(CAST(COALESCE(actual_price, estimated_price, '0') AS DECIMAL)), 0)` })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
          eq(jobs.status, "completed")
        )
      )

    const totalPaidOut = await db
      .select({ total: sql<number>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)` })
      .from(employeePayouts)
      .where(
        and(
          eq(employeePayouts.employeeId, session.id),
          eq(employeePayouts.status, "paid")
        )
      )

    // Format jobs for response
    const formatJob = ({ job, assignment, customer, plan }: any) => ({
      id: job.id,
      title: job.title,
      customer: customer ? `${customer.firstName} ${customer.lastName}` : null,
      scheduledFor: job.scheduledFor,
      completedAt: job.completedAt,
      durationMinutes: job.durationMinutes,
      planEstimatedDuration: plan?.estimatedDuration || null,
      employeePay: assignment?.payAmount ?? job.employeePay ?? null,
      estimatedPrice: job.estimatedPrice,
      actualPrice: job.actualPrice,
      status: job.status,
      location: [job.location, job.city, job.postcode].filter(Boolean).join(", "),
      earnings: assignment?.payAmount
        ? parseFloat(assignment.payAmount)
        : job.employeePay
          ? parseFloat(job.employeePay)
        : parseFloat(job.actualPrice || job.estimatedPrice || "0") || 
          ((job.durationMinutes || 60) / 60) * hourlyRate,
      isPaid: paidJobIds.has(job.id),
    })

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        hourlyRate,
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        completedJobsCount: completedJobs.length,
        scheduledJobsCount: scheduledJobs.length,
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        completedEarnings: Math.round(completedEarnings * 100) / 100,
        scheduledEarnings: Math.round(scheduledEarnings * 100) / 100,
        totalEarnings: Math.round((completedEarnings + scheduledEarnings) * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstandingAmount: Math.round(outstandingAmount * 100) / 100,
        currency,
      },
      lifetime: {
        totalJobsCompleted: Number(allTimeCompleted[0]?.count || 0),
        totalEarned: Math.round(Number(allTimeCompleted[0]?.total || 0) * 100) / 100,
        totalPaidOut: Math.round(Number(totalPaidOut[0]?.total || 0) * 100) / 100,
      },
      completedJobs: completedJobs.map(formatJob),
      scheduledJobs: scheduledJobs.map(formatJob),
      paidJobs: paidJobs.map(formatJob),
      outstandingJobs: outstandingJobs.map(formatJob),
      recentPayouts: payouts.map(p => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        jobCount: p.jobCount,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching employee finances:", error)
    return NextResponse.json(
      { error: "Failed to fetch finances" },
      { status: 500 }
    )
  }
}
