import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"

// POST /api/jobs/[id]/start - Start/clock-in to a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const body = await request.json()
    const { latitude, longitude, notes } = body

    // Verify job exists and belongs to company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
      with: {
        customer: true,
        assignee: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check job isn't already completed or cancelled
    if (job.status === "completed") {
      return NextResponse.json({ error: "Job is already completed" }, { status: 400 })
    }

    if (job.status === "cancelled") {
      return NextResponse.json({ error: "Cannot start a cancelled job" }, { status: 400 })
    }

    const startTime = new Date()

    // Update job status
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        status: "in-progress",
        updatedAt: startTime,
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Create work session for time tracking
    const [workSession] = await db
      .insert(schema.workSessions)
      .values({
        employeeId: job.assignedTo || session.id,
        jobId: jobId,
        startedAt: startTime,
        notes: notes || null,
      })
      .returning()

    // Log the event using jobEvents table
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "job_started",
      message: `Job "${job.title}" started`,
      meta: JSON.stringify({
        jobId,
        startTime: startTime.toISOString(),
        latitude,
        longitude,
        workSessionId: workSession.id,
        startedBy: session.id,
      }),
      actorId: null,
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
      workSession,
      message: "Job started successfully",
      startTime: startTime.toISOString(),
    })
  } catch (error) {
    console.error("Start job error:", error)
    return NextResponse.json({ error: "Failed to start job" }, { status: 500 })
  }
}
