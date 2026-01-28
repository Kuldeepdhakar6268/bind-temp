import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, employees, customers, taskVerificationPhotos, jobTasks, jobCheckIns } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * GET /api/jobs/completed
 * Get all completed jobs with photos, employee info, and check-in data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")

    // Build query conditions
    const conditions = [
      eq(jobs.companyId, session.companyId),
      eq(jobs.status, "completed"),
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

        // Get tasks with photos
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

        // Calculate duration
        let jobDuration = null
        if (checkIn && checkOut) {
          const checkInTime = new Date(checkIn.checkedAt).getTime()
          const checkOutTime = new Date(checkOut.checkedAt).getTime()
          jobDuration = Math.floor((checkOutTime - checkInTime) / 1000 / 60) // minutes
        }

        // Count completed tasks
        const tasksCompleted = tasks.filter(t => t.status === "completed").length
        const totalTasks = tasks.length

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
          durationMinutes: job.durationMinutes,
          status: job.status,
          estimatedPrice: job.estimatedPrice,
          employee: employee ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            role: employee.role,
          } : null,
          customer: customer ? {
            id: customer.id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
          } : null,
          photos: photosWithTaskNames,
          checkInTime: checkIn?.checkedAt || null,
          checkOutTime: checkOut?.checkedAt || null,
          jobDuration,
          tasksCompleted,
          totalTasks,
        }
      })
    )

    return NextResponse.json({ jobs: enrichedJobs })
  } catch (error) {
    console.error("Error fetching completed jobs:", error)
    return NextResponse.json({ error: "Failed to fetch completed jobs" }, { status: 500 })
  }
}
