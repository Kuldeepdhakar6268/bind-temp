import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, gte, lte, sql, count, avg, sum } from "drizzle-orm"

// GET /api/jobs/analytics - Get job analytics and metrics
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const employeeId = searchParams.get("employeeId")
    const customerId = searchParams.get("customerId")

    // Default to last 30 days if no dates provided
    const start = startDate 
      ? new Date(startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const baseConditions = [eq(schema.jobs.companyId, session.companyId)]
    
    if (employeeId) {
      baseConditions.push(eq(schema.jobs.assignedTo, parseInt(employeeId)))
    }
    if (customerId) {
      baseConditions.push(eq(schema.jobs.customerId, parseInt(customerId)))
    }

    // Get all jobs in date range
    const jobs = await db.query.jobs.findMany({
      where: and(
        ...baseConditions,
        gte(schema.jobs.scheduledFor, start),
        lte(schema.jobs.scheduledFor, end)
      ),
      with: {
        customer: true,
        assignee: true,
      },
    })

    // Calculate basic stats
    const totalJobs = jobs.length
    const completedJobs = jobs.filter(j => j.status === "completed").length
    const cancelledJobs = jobs.filter(j => j.status === "cancelled").length
    const scheduledJobs = jobs.filter(j => j.status === "scheduled").length
    const inProgressJobs = jobs.filter(j => j.status === "in-progress").length

    // Calculate revenue
    const totalEstimatedRevenue = jobs.reduce((sum, job) => {
      return sum + (job.estimatedPrice ? parseFloat(job.estimatedPrice) : 0)
    }, 0)

    const totalActualRevenue = jobs
      .filter(j => j.status === "completed")
      .reduce((sum, job) => {
        return sum + (job.actualPrice || job.estimatedPrice 
          ? parseFloat(job.actualPrice || job.estimatedPrice || "0") 
          : 0)
      }, 0)

    // Completion rate
    const completionRate = totalJobs > 0 
      ? Math.round((completedJobs / totalJobs) * 100) 
      : 0

    // Cancellation rate
    const cancellationRate = totalJobs > 0 
      ? Math.round((cancelledJobs / totalJobs) * 100) 
      : 0

    // Average job value
    const avgJobValue = completedJobs > 0 
      ? Math.round(totalActualRevenue / completedJobs * 100) / 100 
      : 0

    // Jobs by status
    const jobsByStatus = {
      scheduled: scheduledJobs,
      "in-progress": inProgressJobs,
      completed: completedJobs,
      cancelled: cancelledJobs,
    }

    // Jobs by day of week
    const jobsByDayOfWeek = Array(7).fill(0)
    jobs.forEach(job => {
      if (job.scheduledFor) {
        const dayOfWeek = new Date(job.scheduledFor).getDay()
        jobsByDayOfWeek[dayOfWeek]++
      }
    })

    // Jobs by hour
    const jobsByHour = Array(24).fill(0)
    jobs.forEach(job => {
      if (job.scheduledFor) {
        const hour = new Date(job.scheduledFor).getHours()
        jobsByHour[hour]++
      }
    })

    // Top employees by jobs completed
    const employeeStats: Record<string, { name: string; completed: number; revenue: number }> = {}
    jobs.forEach(job => {
      if (job.assignee) {
        const key = job.assignee.id.toString()
        if (!employeeStats[key]) {
          employeeStats[key] = {
            name: `${job.assignee.firstName} ${job.assignee.lastName}`,
            completed: 0,
            revenue: 0,
          }
        }
        if (job.status === "completed") {
          employeeStats[key].completed++
          employeeStats[key].revenue += job.actualPrice || job.estimatedPrice 
            ? parseFloat(job.actualPrice || job.estimatedPrice || "0") 
            : 0
        }
      }
    })

    const topEmployees = Object.entries(employeeStats)
      .map(([id, stats]) => ({ id: parseInt(id), ...stats }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10)

    // Top customers by jobs
    const customerStats: Record<string, { name: string; jobs: number; revenue: number }> = {}
    jobs.forEach(job => {
      if (job.customer) {
        const key = job.customer.id.toString()
        if (!customerStats[key]) {
          customerStats[key] = {
            name: `${job.customer.firstName} ${job.customer.lastName}`,
            jobs: 0,
            revenue: 0,
          }
        }
        customerStats[key].jobs++
        if (job.status === "completed") {
          customerStats[key].revenue += job.actualPrice || job.estimatedPrice 
            ? parseFloat(job.actualPrice || job.estimatedPrice || "0") 
            : 0
        }
      }
    })

    const topCustomers = Object.entries(customerStats)
      .map(([id, stats]) => ({ id: parseInt(id), ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Daily trends
    const dailyTrends: Record<string, { date: string; jobs: number; completed: number; revenue: number }> = {}
    jobs.forEach(job => {
      if (job.scheduledFor) {
        const dateKey = new Date(job.scheduledFor).toISOString().split("T")[0]
        if (!dailyTrends[dateKey]) {
          dailyTrends[dateKey] = { date: dateKey, jobs: 0, completed: 0, revenue: 0 }
        }
        dailyTrends[dateKey].jobs++
        if (job.status === "completed") {
          dailyTrends[dateKey].completed++
          dailyTrends[dateKey].revenue += job.actualPrice || job.estimatedPrice 
            ? parseFloat(job.actualPrice || job.estimatedPrice || "0") 
            : 0
        }
      }
    })

    const dailyTrendsArray = Object.values(dailyTrends).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Weekly trends
    const weeklyTrends: Record<string, { week: string; jobs: number; completed: number; revenue: number }> = {}
    jobs.forEach(job => {
      if (job.scheduledFor) {
        const date = new Date(job.scheduledFor)
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        const weekKey = weekStart.toISOString().split("T")[0]
        
        if (!weeklyTrends[weekKey]) {
          weeklyTrends[weekKey] = { week: weekKey, jobs: 0, completed: 0, revenue: 0 }
        }
        weeklyTrends[weekKey].jobs++
        if (job.status === "completed") {
          weeklyTrends[weekKey].completed++
          weeklyTrends[weekKey].revenue += job.actualPrice || job.estimatedPrice 
            ? parseFloat(job.actualPrice || job.estimatedPrice || "0") 
            : 0
        }
      }
    })

    const weeklyTrendsArray = Object.values(weeklyTrends).sort(
      (a, b) => new Date(a.week).getTime() - new Date(b.week).getTime()
    )

    // Average quality rating
    const jobsWithRating = jobs.filter(j => j.qualityRating)
    const avgQualityRating = jobsWithRating.length > 0
      ? Math.round(
          jobsWithRating.reduce((sum, j) => sum + parseFloat(j.qualityRating!), 0) / 
          jobsWithRating.length * 100
        ) / 100
      : null

    // Average duration vs estimated
    const completedJobsWithDuration = jobs.filter(j => j.status === "completed" && j.durationMinutes)
    const avgEstimatedDuration = completedJobsWithDuration.length > 0
      ? Math.round(
          completedJobsWithDuration.reduce((sum, j) => sum + (j.durationMinutes || 0), 0) / 
          completedJobsWithDuration.length
        )
      : 60

    return NextResponse.json({
      summary: {
        totalJobs,
        completedJobs,
        scheduledJobs,
        inProgressJobs,
        cancelledJobs,
        completionRate,
        cancellationRate,
        avgJobValue,
        avgQualityRating,
        avgEstimatedDuration,
      },
      revenue: {
        totalEstimated: Math.round(totalEstimatedRevenue * 100) / 100,
        totalActual: Math.round(totalActualRevenue * 100) / 100,
        currency: "GBP",
      },
      distribution: {
        byStatus: jobsByStatus,
        byDayOfWeek: {
          labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          data: jobsByDayOfWeek,
        },
        byHour: {
          labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
          data: jobsByHour,
        },
      },
      rankings: {
        topEmployees,
        topCustomers,
      },
      trends: {
        daily: dailyTrendsArray,
        weekly: weeklyTrendsArray,
      },
      meta: {
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        filters: {
          employeeId: employeeId ? parseInt(employeeId) : null,
          customerId: customerId ? parseInt(customerId) : null,
        },
      },
    })
  } catch (error) {
    console.error("Get job analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

