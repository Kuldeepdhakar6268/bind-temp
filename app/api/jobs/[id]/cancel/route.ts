import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { sendJobCancelledEmail } from "@/lib/email"

// POST /api/jobs/[id]/cancel - Cancel a job
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
    const { 
      reason, 
      cancelFutureRecurrences = false,
      notifyCustomer = true,
      notifyEmployee = true,
      refundAmount,
    } = body

    if (!reason) {
      return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 })
    }

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
      return NextResponse.json({ error: "Cannot cancel a completed job" }, { status: 400 })
    }

    if (job.status === "cancelled") {
      return NextResponse.json({ error: "Job is already cancelled" }, { status: 400 })
    }

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const cancelledAt = new Date()

    // Update job status
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        status: "cancelled",
        internalNotes: `${job.internalNotes || ""}\n\nCancellation reason (${cancelledAt.toISOString()}): ${reason}`,
        updatedAt: cancelledAt,
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Cancel future recurrences if requested
    let cancelledRecurrences = 0
    if (cancelFutureRecurrences && job.parentJobId) {
      // This job is part of a recurring series - cancel future ones
      await db
        .update(schema.jobs)
        .set({
          status: "cancelled",
          updatedAt: cancelledAt,
        })
        .where(
          and(
            eq(schema.jobs.parentJobId, job.parentJobId),
            eq(schema.jobs.companyId, session.companyId),
          )
        )
    } else if (cancelFutureRecurrences && job.recurrence && job.recurrence !== "none") {
      // This is the parent recurring job - cancel all children
      await db
        .update(schema.jobs)
        .set({
          status: "cancelled",
          updatedAt: cancelledAt,
        })
        .where(
          and(
            eq(schema.jobs.parentJobId, jobId),
            eq(schema.jobs.companyId, session.companyId),
          )
        )
    }

    // Log the event using jobEvents table
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "job_cancelled",
      message: `Job "${job.title}" cancelled: ${reason}`,
      meta: JSON.stringify({
        jobId,
        cancelledAt: cancelledAt.toISOString(),
        reason,
        cancelledBy: session.id,
        cancelledRecurrences,
        refundAmount,
      }),
      actorId: null,
    })

    // Send notification email to customer
    const customer = job.customer as any
    if (notifyCustomer && customer?.email) {
      try {
        await sendJobCancelledEmail({
          to: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          jobTitle: job.title,
          originalDate: job.scheduledFor ? new Date(job.scheduledFor) : null,
          reason,
          companyName: company?.name || "Your Cleaning Company",
          contactEmail: company?.email || "",
          contactPhone: company?.phone || "",
          refundAmount: refundAmount || null,
          currency: job.currency || "GBP",
        })
      } catch (emailError) {
        console.error("Failed to send cancellation email to customer:", emailError)
      }
    }

    // Send notification email to assigned employee
    const assignee = job.assignee as any
    if (notifyEmployee && assignee?.email) {
      try {
        await sendJobCancelledEmail({
          to: job.assignee.email,
          customerName: `${job.assignee.firstName} ${job.assignee.lastName}`,
          jobTitle: job.title,
          originalDate: job.scheduledFor ? new Date(job.scheduledFor) : null,
          reason: `Job cancelled: ${reason}`,
          companyName: company?.name || "Your Company",
          contactEmail: "",
          contactPhone: "",
          refundAmount: null,
          currency: job.currency || "GBP",
          isEmployeeNotification: true,
        })
      } catch (emailError) {
        console.error("Failed to send cancellation email to employee:", emailError)
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: "Job cancelled successfully",
      cancelledRecurrences,
    })
  } catch (error) {
    console.error("Cancel job error:", error)
    return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 })
  }
}
