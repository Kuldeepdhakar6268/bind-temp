import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"

// POST /api/jobs/[id]/duplicate - Duplicate a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const body = await request.json()
    const { 
      scheduledFor,
      scheduledEnd,
      customerId,
      assignedTo,
      copyNotes = false,
    } = body

    // Verify job exists and belongs to company
    const originalJob = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
    })

    if (!originalJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Verify new customer if different
    if (customerId && customerId !== originalJob.customerId) {
      const customer = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.id, customerId),
          eq(schema.customers.companyId, session.companyId)
        ),
      })

      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 })
      }
    }

    // Verify new assignee if provided
    if (assignedTo) {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.id, assignedTo),
          eq(schema.employees.companyId, session.companyId)
        ),
      })

      if (!employee) {
        return NextResponse.json({ error: "Assigned employee not found" }, { status: 404 })
      }
    }

    // Create duplicate job
    const [newJob] = await db
      .insert(schema.jobs)
      .values({
        companyId: session.companyId,
        title: `${originalJob.title} (Copy)`,
        description: originalJob.description,
        customerId: customerId || originalJob.customerId,
        assignedTo: assignedTo || originalJob.assignedTo,
        teamMembers: originalJob.teamMembers,
        location: originalJob.location,
        addressLine2: originalJob.addressLine2,
        city: originalJob.city,
        postcode: originalJob.postcode,
        accessInstructions: originalJob.accessInstructions,
        parkingInstructions: originalJob.parkingInstructions,
        specialInstructions: originalJob.specialInstructions,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        durationMinutes: originalJob.durationMinutes,
        status: "scheduled",
        priority: originalJob.priority,
        estimatedPrice: originalJob.estimatedPrice,
        currency: originalJob.currency,
        internalNotes: copyNotes ? originalJob.internalNotes : null,
        planId: originalJob.planId,
      })
      .returning()

    // Log the event
    // Note: actorId references employees table, company users stored in meta
    await db.insert(schema.jobEvents).values({
      jobId: newJob.id,
      type: "duplicated",
      message: `Job duplicated from "${originalJob.title}"`,
      meta: JSON.stringify({
        originalJobId: jobId,
        duplicatedByUserId: session.id,
        duplicatedByRole: session.role,
      }),
      actorId: null,
    })

    if (newJob.planId) {
      try {
        const planTasks = await db.query.planTasks.findMany({
          where: eq(schema.planTasks.planId, newJob.planId),
          orderBy: (tasks, { asc }) => [asc(tasks.order)],
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

    // Fetch the complete job with relations
    const completeJob = await db.query.jobs.findFirst({
      where: eq(schema.jobs.id, newJob.id),
      with: {
        customer: true,
        assignee: true,
      },
    })

    return NextResponse.json({
      success: true,
      job: completeJob,
      message: "Job duplicated successfully",
    })
  } catch (error) {
    console.error("Duplicate job error:", error)
    return NextResponse.json({ error: "Failed to duplicate job" }, { status: 500 })
  }
}
