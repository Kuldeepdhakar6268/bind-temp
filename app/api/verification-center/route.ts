import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, employees, customers, taskVerificationPhotos, jobTasks, jobCheckIns } from "@/lib/db/schema"
import { eq, and, desc, gte, lte, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"

/**
 * GET /api/verification-center
 * Get all completed jobs with photos, employee info, check-in data, and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const dateFilter = searchParams.get("dateFilter") // today, week, month, all

    // Build date filter
    let dateConditions: any[] = []
    const now = new Date()
    
    if (dateFilter === "today") {
      dateConditions = [
        gte(jobs.completedAt, startOfDay(now)),
        lte(jobs.completedAt, endOfDay(now))
      ]
    } else if (dateFilter === "week") {
      dateConditions = [
        gte(jobs.completedAt, startOfWeek(now)),
        lte(jobs.completedAt, endOfWeek(now))
      ]
    } else if (dateFilter === "month") {
      dateConditions = [
        gte(jobs.completedAt, startOfMonth(now)),
        lte(jobs.completedAt, endOfMonth(now))
      ]
    }

    // Build query conditions
    const conditions = [
      eq(jobs.companyId, session.companyId),
      eq(jobs.status, "completed"),
      ...dateConditions
    ]

    if (employeeId) {
      conditions.push(eq(jobs.assignedTo, parseInt(employeeId)))
    }

    // Get completed jobs
    const completedJobs = await db
      .select({
        job: jobs,
      })
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.completedAt))

    // Enrich with related data
    const enrichedJobs = await Promise.all(
      completedJobs.map(async ({ job }) => {
        // Get employee
        let employee = null
        if (job.assignedTo) {
          const [emp] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, job.assignedTo))
            .limit(1)
          employee = emp || null
        }

        // Get customer
        let customer = null
        if (job.customerId) {
          const [cust] = await db
            .select()
            .from(customers)
            .where(eq(customers.id, job.customerId))
            .limit(1)
          customer = cust || null
        }

        // Get verification photos
        const photos = await db
          .select()
          .from(taskVerificationPhotos)
          .where(eq(taskVerificationPhotos.jobId, job.id))
          .orderBy(desc(taskVerificationPhotos.capturedAt))

        // Get tasks
        const tasks = await db
          .select()
          .from(jobTasks)
          .where(eq(jobTasks.jobId, job.id))

        // Map task names to photos
        const photosWithTaskNames = photos.map(photo => {
          const task = tasks.find(t => t.id === photo.taskId)
          return {
            ...photo,
            taskName: task?.title || null,
          }
        })

        // Get check-in data
        const checkIns = await db
          .select()
          .from(jobCheckIns)
          .where(
            and(
              eq(jobCheckIns.jobId, job.id),
              job.assignedTo ? eq(jobCheckIns.employeeId, job.assignedTo) : undefined
            )
          )
          .orderBy(jobCheckIns.checkedAt)

        const checkIn = checkIns.find(c => c.type === "check_in")
        const checkOut = checkIns.find(c => c.type === "check_out")

        // Calculate job duration
        let jobDuration: number | null = null
        if (checkIn && checkOut) {
          const start = new Date(checkIn.checkedAt)
          const end = new Date(checkOut.checkedAt)
          jobDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
        }

        // Calculate verification score
        const verificationScore = photos.length > 0
          ? Math.round((photos.filter(p => p.verificationStatus === "verified").length / photos.length) * 100)
          : 0

        return {
          id: job.id,
          title: job.title,
          description: job.description,
          location: job.location,
          city: job.city,
          postcode: job.postcode,
          scheduledFor: job.scheduledFor,
          scheduledEnd: job.scheduledEnd,
          completedAt: job.completedAt,
          status: job.status,
          estimatedPrice: job.estimatedPrice,
          employee,
          customer,
          photos: photosWithTaskNames,
          checkInTime: checkIn?.checkedAt || null,
          checkOutTime: checkOut?.checkedAt || null,
          checkInLocation: checkIn?.latitude && checkIn?.longitude 
            ? { lat: parseFloat(checkIn.latitude), lng: parseFloat(checkIn.longitude) }
            : null,
          checkOutLocation: checkOut?.latitude && checkOut?.longitude
            ? { lat: parseFloat(checkOut.latitude), lng: parseFloat(checkOut.longitude) }
            : null,
          jobDuration,
          tasksCompleted: tasks.filter(t => t.status === "completed").length,
          totalTasks: tasks.length,
          verificationScore,
        }
      })
    )

    // Calculate employee statistics
    const employeeStatsMap = new Map<number, {
      employee: any
      totalJobs: number
      totalPhotos: number
      verifiedPhotos: number
      rejectedPhotos: number
      pendingPhotos: number
      totalDuration: number
      jobsWithDuration: number
    }>()

    enrichedJobs.forEach(job => {
      if (!job.employee) return
      
      const empId = job.employee.id
      const current = employeeStatsMap.get(empId) || {
        employee: job.employee,
        totalJobs: 0,
        totalPhotos: 0,
        verifiedPhotos: 0,
        rejectedPhotos: 0,
        pendingPhotos: 0,
        totalDuration: 0,
        jobsWithDuration: 0
      }

      current.totalJobs++
      current.totalPhotos += job.photos.length
      current.verifiedPhotos += job.photos.filter(p => p.verificationStatus === "verified").length
      current.rejectedPhotos += job.photos.filter(p => p.verificationStatus === "rejected").length
      current.pendingPhotos += job.photos.filter(p => p.verificationStatus === "pending").length
      if (job.jobDuration) {
        current.totalDuration += job.jobDuration
        current.jobsWithDuration++
      }

      employeeStatsMap.set(empId, current)
    })

    const employeeStats = Array.from(employeeStatsMap.values()).map(stat => ({
      employeeId: stat.employee.id,
      employee: stat.employee,
      totalJobs: stat.totalJobs,
      totalPhotos: stat.totalPhotos,
      verifiedPhotos: stat.verifiedPhotos,
      rejectedPhotos: stat.rejectedPhotos,
      pendingPhotos: stat.pendingPhotos,
      avgJobDuration: stat.jobsWithDuration > 0 ? Math.round(stat.totalDuration / stat.jobsWithDuration) : 0,
      avgPhotosPerJob: stat.totalJobs > 0 ? Math.round(stat.totalPhotos / stat.totalJobs * 10) / 10 : 0,
      verificationRate: stat.totalPhotos > 0 ? Math.round((stat.verifiedPhotos / stat.totalPhotos) * 100) : 0,
      onTimeRate: 100 // Placeholder - would need scheduled vs actual completion time
    }))

    return NextResponse.json({
      jobs: enrichedJobs,
      employeeStats,
      summary: {
        totalJobs: enrichedJobs.length,
        totalPhotos: enrichedJobs.reduce((sum, j) => sum + j.photos.length, 0),
        pendingPhotos: enrichedJobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "pending").length, 0),
        verifiedPhotos: enrichedJobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "verified").length, 0),
        rejectedPhotos: enrichedJobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "rejected").length, 0),
      }
    })
  } catch (error) {
    console.error("Error fetching verification center data:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}
