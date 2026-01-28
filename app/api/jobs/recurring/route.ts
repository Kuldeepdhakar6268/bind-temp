import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, gte, lt, sql } from "drizzle-orm"
import { addDays, addWeeks, addMonths, startOfDay, endOfDay, parseISO } from "date-fns"

// POST /api/jobs/recurring - Generate recurring jobs
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const {
      parentJobId,
      recurrence, // daily, weekly, biweekly, monthly
      startDate,
      endDate,
      daysOfWeek, // For weekly: [0, 1, 2, 3, 4, 5, 6] where 0 = Sunday
      maxOccurrences = 52, // Safety limit
    } = body

    if (!parentJobId) {
      return NextResponse.json({ error: "Parent job ID is required" }, { status: 400 })
    }

    if (!recurrence || recurrence === "none") {
      return NextResponse.json({ error: "Recurrence pattern is required" }, { status: 400 })
    }

    // Get the parent job
    const parentJob = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, parentJobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
    })

    if (!parentJob) {
      return NextResponse.json({ error: "Parent job not found" }, { status: 404 })
    }

    // Calculate dates for recurring jobs
    const start = startDate ? parseISO(startDate) : (parentJob.scheduledFor || new Date())
    const end = endDate ? parseISO(endDate) : addMonths(start, 3) // Default 3 months

    const jobDates: Date[] = []
    let currentDate = new Date(start)
    let occurrences = 0

    while (currentDate <= end && occurrences < maxOccurrences) {
      // Skip dates based on recurrence pattern
      let shouldAdd = false

      switch (recurrence) {
        case "daily":
          shouldAdd = true
          break

        case "weekly":
          if (daysOfWeek && daysOfWeek.length > 0) {
            shouldAdd = daysOfWeek.includes(currentDate.getDay())
          } else {
            shouldAdd = currentDate.getDay() === start.getDay()
          }
          break

        case "biweekly":
          const weeksDiff = Math.floor(
            (currentDate.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
          )
          if (weeksDiff % 2 === 0) {
            shouldAdd = currentDate.getDay() === start.getDay()
          }
          break

        case "monthly":
          shouldAdd = currentDate.getDate() === start.getDate()
          break
      }

      if (shouldAdd && currentDate > start) {
        jobDates.push(new Date(currentDate))
        occurrences++
      }

      // Advance date
      currentDate = addDays(currentDate, 1)
    }

    // Create recurring jobs
    const createdJobs: any[] = []

    for (const date of jobDates) {
      // Calculate the scheduled end time
      let scheduledEnd = null
      if (parentJob.scheduledFor && parentJob.scheduledEnd) {
        const duration = new Date(parentJob.scheduledEnd).getTime() - new Date(parentJob.scheduledFor).getTime()
        scheduledEnd = new Date(date.getTime() + duration)
      }

      // Set the time from parent job
      if (parentJob.scheduledFor) {
        const parentTime = new Date(parentJob.scheduledFor)
        date.setHours(parentTime.getHours(), parentTime.getMinutes(), 0, 0)
      }

      const [newJob] = await db
        .insert(schema.jobs)
        .values({
          companyId: session.companyId,
          title: parentJob.title,
          description: parentJob.description,
          customerId: parentJob.customerId,
          assignedTo: parentJob.assignedTo,
          teamMembers: parentJob.teamMembers,
          location: parentJob.location,
          addressLine2: parentJob.addressLine2,
          city: parentJob.city,
          postcode: parentJob.postcode,
          accessInstructions: parentJob.accessInstructions,
          parkingInstructions: parentJob.parkingInstructions,
          specialInstructions: parentJob.specialInstructions,
          scheduledFor: date,
          scheduledEnd: scheduledEnd,
          durationMinutes: parentJob.durationMinutes,
          recurrence: "none", // Child jobs don't recurr
          parentJobId: parentJobId,
          status: "scheduled",
          priority: parentJob.priority,
          estimatedPrice: parentJob.estimatedPrice,
          currency: parentJob.currency,
          internalNotes: parentJob.internalNotes,
          planId: parentJob.planId,
        })
        .returning()

      createdJobs.push(newJob)

      if (newJob.planId) {
        try {
          const planTasks = await db.query.planTasks.findMany({
            where: eq(schema.planTasks.planId, newJob.planId),
            orderBy: (tasks, { asc: ascTask }) => [ascTask(tasks.order)],
          })

          if (planTasks.length > 0) {
            await db.insert(schema.jobTasks).values(
              planTasks.map((task) => ({
                jobId: newJob.id,
                title: task.title,
                description: task.description || null,
                order: task.order ?? 0,
              }))
            )
          }
        } catch (taskError) {
          console.error("Failed to create job tasks from plan:", taskError)
        }
      }
    }

    // Update parent job with recurrence info
    await db
      .update(schema.jobs)
      .set({
        recurrence,
        recurrenceEndDate: end,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, parentJobId))

    // Log the event
    await db.insert(schema.eventLog).values({
      companyId: session.companyId,
      eventType: "recurring_jobs_created",
      entityType: "job",
      entityId: parentJobId.toString(),
      description: `${createdJobs.length} recurring jobs created for "${parentJob.title}"`,
      metadata: JSON.stringify({
        parentJobId,
        recurrence,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        jobsCreated: createdJobs.length,
        createdBy: session.id,
      }),
    })

    return NextResponse.json({
      success: true,
      jobsCreated: createdJobs.length,
      jobs: createdJobs,
      recurrence,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    })
  } catch (error) {
    console.error("Create recurring jobs error:", error)
    return NextResponse.json({ error: "Failed to create recurring jobs" }, { status: 500 })
  }
}

// GET /api/jobs/recurring - Get recurring job series
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)

    const parentJobId = searchParams.get("parentJobId")

    if (!parentJobId) {
      // Get all parent recurring jobs
      const parentJobs = await db.query.jobs.findMany({
        where: and(
          eq(schema.jobs.companyId, session.companyId),
          sql`${schema.jobs.recurrence} IS NOT NULL AND ${schema.jobs.recurrence} != 'none'`
        ),
        with: {
          customer: true,
          assignee: true,
        },
      })

      // Count child jobs for each parent
      const parentsWithCounts = await Promise.all(
        parentJobs.map(async (parent) => {
          const childJobs = await db.query.jobs.findMany({
            where: and(
              eq(schema.jobs.parentJobId, parent.id),
              eq(schema.jobs.companyId, session.companyId)
            ),
            columns: { id: true, status: true },
          })

          return {
            ...parent,
            childJobCount: childJobs.length,
            completedCount: childJobs.filter((j) => j.status === "completed").length,
            upcomingCount: childJobs.filter((j) => j.status === "scheduled").length,
          }
        })
      )

      return NextResponse.json(parentsWithCounts)
    }

    // Get specific recurring series
    const parentJob = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, parseInt(parentJobId)),
        eq(schema.jobs.companyId, session.companyId)
      ),
      with: {
        customer: true,
        assignee: true,
      },
    })

    if (!parentJob) {
      return NextResponse.json({ error: "Parent job not found" }, { status: 404 })
    }

    const childJobs = await db.query.jobs.findMany({
      where: and(
        eq(schema.jobs.parentJobId, parseInt(parentJobId)),
        eq(schema.jobs.companyId, session.companyId)
      ),
      with: {
        customer: true,
        assignee: true,
      },
      orderBy: (jobs, { asc }) => [asc(jobs.scheduledFor)],
    })

    return NextResponse.json({
      parent: parentJob,
      children: childJobs,
      stats: {
        total: childJobs.length,
        completed: childJobs.filter((j) => j.status === "completed").length,
        scheduled: childJobs.filter((j) => j.status === "scheduled").length,
        cancelled: childJobs.filter((j) => j.status === "cancelled").length,
      },
    })
  } catch (error) {
    console.error("Get recurring jobs error:", error)
    return NextResponse.json({ error: "Failed to fetch recurring jobs" }, { status: 500 })
  }
}

