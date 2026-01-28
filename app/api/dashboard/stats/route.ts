import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  jobs,
  employees,
  invoices,
  taskVerificationPhotos,
  jobTasks
} from "@/lib/db/schema"
import { eq, and, gte, lte, lt, sql, count, sum } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns"

/**
 * GET /api/dashboard/stats
 * Get comprehensive dashboard statistics with date range filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month" // today, week, month, quarter, year, custom
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const now = new Date()
    let startDate: Date
    let endDate: Date = endOfDay(now)
    let previousStartDate: Date
    let previousEndDate: Date

    // Calculate date ranges based on period
    switch (period) {
      case "today":
        startDate = startOfDay(now)
        previousStartDate = startOfDay(subDays(now, 1))
        previousEndDate = endOfDay(subDays(now, 1))
        break
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        previousStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        previousEndDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        break
      case "month":
        startDate = startOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
        break
      case "quarter":
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        startDate = quarterStart
        previousStartDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth() - 3, 1)
        previousEndDate = new Date(quarterStart.getFullYear(), quarterStart.getMonth(), 0)
        break
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1)
        previousStartDate = new Date(now.getFullYear() - 1, 0, 1)
        previousEndDate = new Date(now.getFullYear() - 1, 11, 31)
        break
      case "custom":
        startDate = startDateParam ? new Date(startDateParam) : startOfMonth(now)
        endDate = endDateParam ? new Date(endDateParam) : endOfDay(now)
        // For custom, compare to same duration before
        const duration = endDate.getTime() - startDate.getTime()
        previousEndDate = new Date(startDate.getTime() - 1)
        previousStartDate = new Date(previousEndDate.getTime() - duration)
        break
      default:
        startDate = startOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
    }

    const companyId = session.companyId

    // ===== REVENUE CALCULATIONS =====
    // Current period revenue (paid invoices)
    const currentRevenueResult = await db
      .select({ total: sum(invoices.total) })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, startDate),
          lte(invoices.paidAt, endDate)
        )
      )
    const currentRevenue = parseFloat(currentRevenueResult[0]?.total || "0")

    // Previous period revenue
    const previousRevenueResult = await db
      .select({ total: sum(invoices.total) })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, previousStartDate),
          lte(invoices.paidAt, previousEndDate)
        )
      )
    const previousRevenue = parseFloat(previousRevenueResult[0]?.total || "0")
    const revenueChange = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0

    // ===== JOB STATISTICS =====
    // Active jobs (scheduled or in-progress) within period
    const activeJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          sql`${jobs.status} IN ('scheduled', 'in-progress')`,
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
    const activeJobs = activeJobsResult[0]?.count || 0

    // Jobs in current period
    const periodJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
    const periodJobs = periodJobsResult[0]?.count || 0

    // Previous period jobs
    const prevPeriodJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          gte(jobs.scheduledFor, previousStartDate),
          lte(jobs.scheduledFor, previousEndDate)
        )
      )
    const prevPeriodJobs = prevPeriodJobsResult[0]?.count || 0

    // Completed jobs in current period
    const completedJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, startDate),
          lte(jobs.completedAt, endDate)
        )
      )
    const completedJobs = completedJobsResult[0]?.count || 0

    // Previous period completed jobs
    const prevCompletedJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, "completed"),
          gte(jobs.completedAt, previousStartDate),
          lte(jobs.completedAt, previousEndDate)
        )
      )
    const prevCompletedJobs = prevCompletedJobsResult[0]?.count || 0

    // Total jobs for completion rate (all time vs period)
    const totalJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.companyId, companyId))
    const totalJobs = totalJobsResult[0]?.count || 0

    const allCompletedJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, "completed")
        )
      )
    const allCompletedJobs = allCompletedJobsResult[0]?.count || 0
    const completionRateAllTime = totalJobs > 0 ? (allCompletedJobs / totalJobs) * 100 : 0

    // Period completion rate
    const periodCompletionRate = periodJobs > 0 ? (completedJobs / periodJobs) * 100 : 0
    const prevPeriodCompletionRate = prevPeriodJobs > 0 ? (prevCompletedJobs / prevPeriodJobs) * 100 : 0

    // ===== STAFF STATISTICS =====
    // Active employees
    const activeEmployeesResult = await db
      .select({ count: count() })
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          eq(employees.status, "active")
        )
      )
    const activeEmployees = activeEmployeesResult[0]?.count || 0

    // ===== PENDING TASKS =====
    const pendingTasksResult = await db
      .select({ count: count() })
      .from(jobTasks)
      .innerJoin(jobs, eq(jobTasks.jobId, jobs.id))
      .where(
        and(
          eq(jobs.companyId, companyId),
          sql`${jobTasks.status} IN ('pending', 'in-progress')`,
          sql`${jobs.status} IN ('scheduled', 'in-progress')`,
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
    const pendingTasks = pendingTasksResult[0]?.count || 0

    // ===== OVERDUE JOBS =====
    // Jobs that should have started already but are still scheduled or in-progress
    const overdueJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          sql`${jobs.status} IN ('scheduled', 'in-progress')`,
          lt(jobs.scheduledFor, now),
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
    const overdueJobs = overdueJobsResult[0]?.count || 0

    // Scheduled jobs count
    const scheduledJobsResult = await db
      .select({ count: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.companyId, companyId),
          eq(jobs.status, "scheduled"),
          gte(jobs.scheduledFor, startDate),
          lte(jobs.scheduledFor, endDate)
        )
      )
    const scheduledJobs = scheduledJobsResult[0]?.count || 0

    // ===== VERIFICATION STATS =====
    const photosResult = await db
      .select({ count: count() })
      .from(taskVerificationPhotos)
      .where(
        and(
          eq(taskVerificationPhotos.companyId, companyId),
          gte(taskVerificationPhotos.capturedAt, startDate),
          lte(taskVerificationPhotos.capturedAt, endDate)
        )
      )
    const totalPhotos = photosResult[0]?.count || 0

    const pendingPhotosResult = await db
      .select({ count: count() })
      .from(taskVerificationPhotos)
      .where(
        and(
          eq(taskVerificationPhotos.companyId, companyId),
          eq(taskVerificationPhotos.verificationStatus, "pending"),
          gte(taskVerificationPhotos.capturedAt, startDate),
          lte(taskVerificationPhotos.capturedAt, endDate)
        )
      )
    const pendingPhotos = pendingPhotosResult[0]?.count || 0

    return NextResponse.json({
      period: {
        type: period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        previousStartDate: previousStartDate.toISOString(),
        previousEndDate: previousEndDate.toISOString(),
      },
      stats: {
        // Revenue
        totalRevenue: currentRevenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
        previousRevenue,

        // Jobs
        activeJobs,
        periodJobs,
        completedJobs,
        completedJobsChange: completedJobs - prevCompletedJobs,
        scheduledJobs,

        // Completion Rate
        completionRate: Math.round(periodCompletionRate * 10) / 10,
        completionRateAllTime: Math.round(completionRateAllTime * 10) / 10,
        periodCompletionRate: Math.round(periodCompletionRate * 10) / 10,
        completionRateChange: Math.round((periodCompletionRate - prevPeriodCompletionRate) * 10) / 10,

        // Staff
        activeEmployees,

        // Tasks
        pendingTasks,
        overdueJobs,

        // Photos
        totalPhotos,
        pendingPhotos,
      },
      breakdown: {
        // Detailed breakdowns for charts
        jobsByStatus: {
          scheduled: scheduledJobs,
          inProgress: activeJobs - scheduledJobs,
          completed: completedJobs,
        },
      }
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
