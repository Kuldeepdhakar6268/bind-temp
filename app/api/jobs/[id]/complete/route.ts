import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, isNull } from "drizzle-orm"
import { sendJobCompletedEmail } from "@/lib/email"
import { randomBytes } from "crypto"
import { generateInvoiceFromJob } from "@/lib/invoice-utils"
import { generateInvoicePdfBuffer } from "@/lib/invoices-pdf"

// POST /api/jobs/[id]/complete - Complete a job
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
      latitude, 
      longitude, 
      notes, 
      actualPrice, 
      qualityRating,
      sendCustomerNotification = true,
      checklistCompleted = [],
      photoIds = [],
    } = body

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

    // Check job isn't already completed
    if (job.status === "completed") {
      return NextResponse.json({ error: "Job is already completed" }, { status: 400 })
    }

    if (job.status === "cancelled") {
      return NextResponse.json({ error: "Cannot complete a cancelled job" }, { status: 400 })
    }

    const completedAt = new Date()

    // Generate secure feedback token for public feedback submission
    const feedbackToken = randomBytes(32).toString("base64url")

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })
    const plan = job.planId
      ? await db.query.cleaningPlans.findFirst({
          where: eq(schema.cleaningPlans.id, job.planId),
        })
      : null
    const planPrice = plan?.price ? parseFloat(plan.price) : 0

    // Update job status and set feedback token
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        status: "completed",
        completedAt,
        actualPrice: actualPrice || job.estimatedPrice || (planPrice ? planPrice.toFixed(2) : null),
        qualityRating: qualityRating || null,
        feedbackToken: feedbackToken,
        internalNotes: notes ? `${job.internalNotes || ""}\n\nCompletion notes: ${notes}` : job.internalNotes,
        updatedAt: completedAt,
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Close any open work session for this job (using endedAt instead of clockOut)
    const openWorkSession = await db.query.workSessions.findFirst({
      where: and(
        eq(schema.workSessions.jobId, jobId),
        isNull(schema.workSessions.endedAt)
      ),
    })

    if (openWorkSession) {
      await db
        .update(schema.workSessions)
        .set({
          endedAt: completedAt,
        })
        .where(eq(schema.workSessions.id, openWorkSession.id))
    }

    // Log the event using jobEvents table
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "job_completed",
      message: `Job "${job.title}" completed`,
      meta: JSON.stringify({
        jobId,
        completedAt: completedAt.toISOString(),
        latitude,
        longitude,
        actualPrice,
        qualityRating,
        completedBy: session.id,
        photoCount: photoIds.length,
        checklistItems: checklistCompleted.length,
      }),
      actorId: null,
    })

    // Calculate job duration
    let durationMinutes = job.durationMinutes || 60
    if (openWorkSession?.startedAt) {
      durationMinutes = Math.round(
        (completedAt.getTime() - new Date(openWorkSession.startedAt).getTime()) / 60000
      )
    }

    // Send notification email to customer
    const customer = job.customer as any
    if (sendCustomerNotification && customer?.email) {
      try {
        const assignee = job.assignee as any
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
        let invoiceForEmail = await db.query.invoices.findFirst({
          where: and(
            eq(schema.invoices.companyId, session.companyId),
            eq(schema.invoices.jobId, jobId),
          ),
          orderBy: (table, { desc }) => [desc(table.id)],
        })

        if (!invoiceForEmail) {
          try {
            invoiceForEmail = await generateInvoiceFromJob({
              companyId: session.companyId,
              jobId,
            })

            await db
              .update(schema.invoices)
              .set({
                status: "sent",
                amountDue: invoiceForEmail.total,
                updatedAt: new Date(),
              })
              .where(eq(schema.invoices.id, invoiceForEmail.id))
          } catch (invoiceError) {
            console.error("Failed to generate invoice on job completion:", invoiceError)
            invoiceForEmail = null
          }
        }

        let pdfBuffer: Buffer | undefined
        if (invoiceForEmail) {
          try {
            pdfBuffer = await generateInvoicePdfBuffer(invoiceForEmail.id, session.companyId)
          } catch (pdfError) {
            console.error("Failed to generate invoice PDF on job completion:", pdfError)
          }
        }

        const paymentUrl = pdfBuffer ? `${baseUrl}/portal/dashboard` : undefined
        await sendJobCompletedEmail({
          to: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          jobTitle: job.title,
          jobDescription: job.description || "",
          completedDate: completedAt,
          durationMinutes,
          actualPrice: actualPrice || job.estimatedPrice || (planPrice ? planPrice.toFixed(2) : "0"),
          currency: job.currency || "GBP",
          employeeName: assignee 
            ? `${assignee.firstName} ${assignee.lastName}` 
            : "Our team",
          companyName: company?.name || "Your Cleaning Company",
          feedbackUrl: `${baseUrl}/job/${jobId}/feedback?token=${feedbackToken}`,
          paymentUrl,
          invoiceNumber: invoiceForEmail?.invoiceNumber || null,
          pdfBuffer,
        })
      } catch (emailError) {
        console.error("Failed to send completion email:", emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: "Job completed successfully",
      completedAt: completedAt.toISOString(),
      duration: durationMinutes,
    })
  } catch (error) {
    console.error("Complete job error:", error)
    return NextResponse.json({ error: "Failed to complete job" }, { status: 500 })
  }
}
