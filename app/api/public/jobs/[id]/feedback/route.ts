import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

// POST /api/public/jobs/[id]/feedback - Submit feedback for a job (public)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const body = await request.json()
    const { rating, feedback, token } = body

    // Validate token is provided
    if (!token) {
      return NextResponse.json({ error: "Feedback token is required" }, { status: 401 })
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    // Verify job exists
    const job = await db.query.jobs.findFirst({
      where: eq(schema.jobs.id, jobId),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Validate feedback token
    if (!job.feedbackToken || job.feedbackToken !== token) {
      return NextResponse.json({ error: "Invalid feedback token" }, { status: 403 })
    }

    // Check if job is completed
    if (job.status !== "completed") {
      return NextResponse.json({ error: "Can only leave feedback for completed jobs" }, { status: 400 })
    }

    // Check if feedback was already submitted
    if (job.qualityRating) {
      return NextResponse.json({ error: "Feedback has already been submitted for this job" }, { status: 400 })
    }

    // Update job with feedback
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        qualityRating: rating.toString(),
        customerFeedback: feedback || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Log the event
    await db.insert(schema.eventLog).values({
      companyId: job.companyId,
      eventType: "customer_feedback_received",
      entityType: "job",
      entityId: jobId.toString(),
      description: `Customer feedback received for job "${job.title}": ${rating}/5 stars`,
      metadata: JSON.stringify({
        jobId,
        rating,
        feedback: feedback || null,
      }),
    })

    // Also save to customer feedback table if exists
    try {
      await db.insert(schema.customerFeedback).values({
        companyId: job.companyId,
        customerId: job.customerId,
        jobId: jobId,
        rating: rating.toString(),
        comment: feedback || null,
        category: "service",
        status: "new",
      })
    } catch (err) {
      // Ignore if customer feedback table doesn't exist or other error
      console.log("Could not save to customer feedback table:", err)
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
      rating,
    })
  } catch (error) {
    console.error("Submit feedback error:", error)
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 })
  }
}
