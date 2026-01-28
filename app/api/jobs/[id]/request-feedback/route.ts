import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"
import { generateSecureToken, generateFeedbackUrl } from "@/lib/utils"
import { sendFeedbackRequestEmail } from "@/lib/email"

// POST /api/jobs/[id]/request-feedback - Send feedback request to customer
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

    // Get job with customer and company data
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

    if (job.status !== "completed") {
      return NextResponse.json(
        { error: "Can only request feedback for completed jobs" },
        { status: 400 }
      )
    }

    if (!job.customer?.email) {
      return NextResponse.json(
        { error: "Customer email not found" },
        { status: 400 }
      )
    }

    // Generate feedback token if not already exists
    let feedbackToken = job.feedbackToken
    if (!feedbackToken) {
      feedbackToken = generateSecureToken(32)
      await db
        .update(schema.jobs)
        .set({ feedbackToken })
        .where(eq(schema.jobs.id, jobId))
    }

    const feedbackUrl = generateFeedbackUrl(feedbackToken)
    const customerName = `${job.customer.firstName} ${job.customer.lastName}`
    const staffName = job.assignee
      ? `${job.assignee.firstName} ${job.assignee.lastName}`
      : null

    // Send feedback request email
    await sendFeedbackRequestEmail(
      job.customer.email,
      customerName,
      session.company.name,
      job.title,
      feedbackUrl,
      job.completedAt,
      staffName
    )

    return NextResponse.json({
      success: true,
      message: "Feedback request sent successfully",
      feedbackUrl,
    })
  } catch (error) {
    console.error("Error sending feedback request:", error)
    return NextResponse.json(
      { error: "Failed to send feedback request" },
      { status: 500 }
    )
  }
}
