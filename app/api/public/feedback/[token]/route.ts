import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"

// GET /api/public/feedback/[token] - Get job details for feedback submission
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const { token } = params

    if (!token) {
      return NextResponse.json(
        { error: "Feedback token is required" },
        { status: 400 }
      )
    }

    // Find job by feedback token
    const job = await db.query.jobs.findFirst({
      where: eq(schema.jobs.feedbackToken, token),
      with: {
        customer: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
        assignee: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
        company: {
          columns: {
            name: true,
            logo: true,
          },
        },
      },
    })

    if (!job) {
      return NextResponse.json(
        { error: "Invalid or expired feedback link" },
        { status: 404 }
      )
    }

    // Check if feedback already submitted
    if (job.qualityRating || job.customerFeedback) {
      return NextResponse.json(
        {
          alreadySubmitted: true,
          message: "Thank you! You've already submitted feedback for this job.",
        }
      )
    }

    return NextResponse.json({
      jobId: job.id,
      jobTitle: job.title,
      completedAt: job.completedAt,
      customerName: job.customer
        ? `${job.customer.firstName} ${job.customer.lastName}`
        : null,
      staffName: job.assignee
        ? `${job.assignee.firstName} ${job.assignee.lastName}`
        : null,
      companyName: job.company?.name || null,
      companyLogo: job.company?.logo || null,
    })
  } catch (error) {
    console.error("Error fetching job for feedback:", error)
    return NextResponse.json(
      { error: "Failed to fetch job details" },
      { status: 500 }
    )
  }
}

// POST /api/public/feedback/[token] - Submit feedback for a job (public, no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const { token } = params
    const body = await request.json()
    const { rating, comment } = body

    if (!token) {
      return NextResponse.json(
        { error: "Feedback token is required" },
        { status: 400 }
      )
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      )
    }

    // Find job by feedback token
    const job = await db.query.jobs.findFirst({
      where: eq(schema.jobs.feedbackToken, token),
    })

    if (!job) {
      return NextResponse.json(
        { error: "Invalid or expired feedback link" },
        { status: 404 }
      )
    }

    // Check if feedback already submitted
    if (job.qualityRating || job.customerFeedback) {
      return NextResponse.json(
        { error: "Feedback has already been submitted for this job" },
        { status: 400 }
      )
    }

    // Update job with feedback
    await db
      .update(schema.jobs)
      .set({
        qualityRating: rating.toString(),
        customerFeedback: comment || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, job.id))

    // Also create a customer_feedback record for better tracking
    await db.insert(schema.customerFeedback).values({
      companyId: job.companyId,
      customerId: job.customerId,
      jobId: job.id,
      rating,
      comment: comment || null,
      feedbackToken: token,
    })

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
    })
  } catch (error) {
    console.error("Error submitting feedback:", error)
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    )
  }
}
