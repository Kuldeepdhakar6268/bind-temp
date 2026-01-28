import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { workSessions, jobs, customerSignatures, jobCheckIns, jobAssignments } from "@/lib/db/schema"
import { eq, and, gte, sum, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

// GET /api/employee/stats - Get employee statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month" // week, month, year, all

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "week":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        break
      case "year":
        startDate = new Date(now)
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate = new Date(0) // Beginning of time
    }

    // Get job statistics
    const allJobs = await db
      .select({ job: jobs })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
        )
      )

    const jobRecords = allJobs.map((row) => row.job)

    const periodJobs = jobRecords.filter(j => new Date(j.createdAt) >= startDate)

    const totalJobs = periodJobs.length
    const completedJobs = periodJobs.filter(j => j.status === "completed").length
    const inProgressJobs = periodJobs.filter(j => j.status === "in_progress").length
    const scheduledJobs = periodJobs.filter(j => j.status === "scheduled").length
    const cancelledJobs = periodJobs.filter(j => j.status === "cancelled").length

    // Calculate completion rate
    const nonCancelledJobs = totalJobs - cancelledJobs
    const completionRate = nonCancelledJobs > 0 
      ? Math.round((completedJobs / nonCancelledJobs) * 100) 
      : 0

    // Get average rating from signatures
    let signatures: any[] = []
    try {
      signatures = await db
        .select()
        .from(customerSignatures)
        .where(
          and(
            eq(customerSignatures.employeeId, session.id),
            gte(customerSignatures.signedAt, startDate)
          )
        )
    } catch {
      // Table might not exist yet
      signatures = []
    }

    const ratingsWithValue = signatures.filter(s => s.rating !== null)
    const averageRating = ratingsWithValue.length > 0
      ? ratingsWithValue.reduce((sum, s) => sum + (s.rating || 0), 0) / ratingsWithValue.length
      : null

    const totalRatings = ratingsWithValue.length
    const fiveStarRatings = ratingsWithValue.filter(s => s.rating === 5).length

    // Get check-in statistics for on-time tracking
    let checkIns: any[] = []
    try {
      checkIns = await db
        .select()
        .from(jobCheckIns)
        .where(
          and(
            eq(jobCheckIns.employeeId, session.id),
            eq(jobCheckIns.type, "check_in"),
            gte(jobCheckIns.checkedAt, startDate)
          )
        )
    } catch {
      // Table might not exist yet
      checkIns = []
    }

    const totalCheckIns = checkIns.length
    const onSiteCheckIns = checkIns.filter(c => c.isWithinRange === 1).length
    const onTimeRate = totalCheckIns > 0 
      ? Math.round((onSiteCheckIns / totalCheckIns) * 100) 
      : 100

    // Get total hours worked from work sessions
    const totalHoursResult = await db
      .select({ total: sum(workSessions.durationMinutes) })
      .from(workSessions)
      .where(
        and(
          eq(workSessions.employeeId, session.id),
          gte(workSessions.startedAt, startDate)
        )
      )

    const totalMinutesWorked = Number(totalHoursResult[0]?.total || 0)

    // Get this week's hours
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const weekHoursResult = await db
      .select({ total: sum(workSessions.durationMinutes) })
      .from(workSessions)
      .where(
        and(
          eq(workSessions.employeeId, session.id),
          gte(workSessions.startedAt, weekStart)
        )
      )

    const weekMinutes = Number(weekHoursResult[0]?.total || 0)

    // Get jobs by week for chart data (last 4 weeks)
    const weeklyData: { week: string; completed: number; total: number }[] = []
    for (let i = 3; i >= 0; i--) {
      const weekStartDate = new Date(now)
      weekStartDate.setDate(now.getDate() - (i + 1) * 7)
      const weekEndDate = new Date(now)
      weekEndDate.setDate(now.getDate() - i * 7)

      const weekJobs = jobRecords.filter(j => {
        const createdAt = new Date(j.createdAt)
        return createdAt >= weekStartDate && createdAt < weekEndDate
      })

      weeklyData.push({
        week: `Week ${4 - i}`,
        completed: weekJobs.filter(j => j.status === "completed").length,
        total: weekJobs.length,
      })
    }

    // Get rating distribution
    const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
      rating: star,
      count: ratingsWithValue.filter(s => s.rating === star).length,
    }))

    return NextResponse.json({
      summary: {
        totalJobs,
        completedJobs,
        inProgressJobs,
        scheduledJobs,
        cancelledJobs,
        completionRate,
        averageRating: averageRating ? parseFloat(averageRating.toFixed(1)) : null,
        totalRatings,
        fiveStarRatings,
        onTimeRate,
        totalHoursWorked: Math.round(totalMinutesWorked / 60 * 10) / 10,
        thisWeekHours: Math.round(weekMinutes / 60 * 10) / 10,
      },
      weeklyData,
      ratingDistribution,
      period,
    })
  } catch (error) {
    console.error("Error fetching employee stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    )
  }
}


