import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { sendJobConfirmationEmail } from "@/lib/email"

// POST /api/jobs/[id]/send-confirmation - Send job confirmation to customer
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
    const { customMessage } = body

    // Verify job exists and belongs to company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
      with: {
        customer: true,
        assignee: true,
        plan: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (!job.customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    // Send confirmation email
    const resolvedEstimatedPrice = job.estimatedPrice ?? job.plan?.price ?? "0"

    await sendJobConfirmationEmail({
      to: job.customer.email,
      customerName: `${job.customer.firstName} ${job.customer.lastName}`,
      jobTitle: job.title,
      jobDescription: job.description || "",
      scheduledDate: job.scheduledFor ? new Date(job.scheduledFor) : null,
      scheduledEndDate: job.scheduledEnd ? new Date(job.scheduledEnd) : null,
      durationMinutes: job.durationMinutes || 60,
      location: job.location || "",
      city: job.city || "",
      postcode: job.postcode || "",
      accessInstructions: job.accessInstructions || "",
      estimatedPrice: resolvedEstimatedPrice || "0",
      currency: job.currency || "GBP",
      employeeName: job.assignee 
        ? `${job.assignee.firstName} ${job.assignee.lastName}` 
        : null,
      companyName: company?.name || "Your Cleaning Company",
      companyPhone: company?.phone || "",
      companyEmail: company?.email || "",
      customMessage: customMessage || null,
      jobUrl: `${process.env.NEXT_PUBLIC_APP_URL}/job/${jobId}`,
      rescheduleUrl: `${process.env.NEXT_PUBLIC_APP_URL}/job/${jobId}/reschedule`,
    })

    // Log the event
    // Note: actorId references employees table, company users stored in meta
    const customer = job.customer as any
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "confirmation_sent",
      message: `Job confirmation sent to ${customer.email}`,
      meta: JSON.stringify({
        customerEmail: customer.email,
        sentByUserId: session.id,
        sentByRole: session.role,
      }),
      actorId: null,
    })

    return NextResponse.json({
      success: true,
      message: "Confirmation email sent successfully",
      sentTo: job.customer.email,
    })
  } catch (error) {
    console.error("Send confirmation error:", error)
    return NextResponse.json({ error: "Failed to send confirmation" }, { status: 500 })
  }
}
