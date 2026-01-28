import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { sendJobReminderEmail } from "@/lib/email"

// POST /api/jobs/[id]/send-reminder - Send job reminder
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
      sendToCustomer = true, 
      sendToEmployee = true,
      customMessage,
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

    if (!job.scheduledFor) {
      return NextResponse.json({ error: "Job has no scheduled date" }, { status: 400 })
    }

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const results = {
      customerSent: false,
      employeeSent: false,
      errors: [] as string[],
    }

    // Calculate time until job
    const scheduledDate = new Date(job.scheduledFor)
    const now = new Date()
    const hoursUntil = Math.round((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60))
    const daysUntil = Math.round(hoursUntil / 24)

    let timeUntilText = "soon"
    if (daysUntil > 1) {
      timeUntilText = `in ${daysUntil} days`
    } else if (daysUntil === 1) {
      timeUntilText = "tomorrow"
    } else if (hoursUntil > 1) {
      timeUntilText = `in ${hoursUntil} hours`
    } else if (hoursUntil === 1) {
      timeUntilText = "in 1 hour"
    }

    // Send reminder to customer
    if (sendToCustomer && job.customer?.email) {
      try {
        await sendJobReminderEmail({
          to: job.customer.email,
          recipientName: `${job.customer.firstName} ${job.customer.lastName}`,
          jobTitle: job.title,
          scheduledDate: scheduledDate,
          durationMinutes: job.durationMinutes || 60,
          location: job.location || "",
          city: job.city || "",
          postcode: job.postcode || "",
          accessInstructions: job.accessInstructions || "",
          employeeName: job.assignee 
            ? `${job.assignee.firstName} ${job.assignee.lastName}` 
            : null,
          companyName: company?.name || "Your Cleaning Company",
          companyPhone: company?.phone || "",
          timeUntil: timeUntilText,
          customMessage: customMessage || null,
          isEmployeeReminder: false,
          rescheduleUrl: `${process.env.NEXT_PUBLIC_APP_URL}/job/${jobId}/reschedule`,
        })
        results.customerSent = true
      } catch (emailError) {
        results.errors.push(`Customer email failed: ${emailError}`)
      }
    }

    // Send reminder to employee
    if (sendToEmployee && job.assignee?.email) {
      try {
        await sendJobReminderEmail({
          to: job.assignee.email,
          recipientName: `${job.assignee.firstName} ${job.assignee.lastName}`,
          jobTitle: job.title,
          scheduledDate: scheduledDate,
          durationMinutes: job.durationMinutes || 60,
          location: job.location || "",
          city: job.city || "",
          postcode: job.postcode || "",
          accessInstructions: job.accessInstructions || "",
          employeeName: null,
          companyName: company?.name || "Your Company",
          companyPhone: "",
          timeUntil: timeUntilText,
          customMessage: customMessage || null,
          isEmployeeReminder: true,
          customerName: job.customer 
            ? `${job.customer.firstName} ${job.customer.lastName}` 
            : "Customer",
          customerPhone: job.customer?.phone || "",
        })
        results.employeeSent = true
      } catch (emailError) {
        results.errors.push(`Employee email failed: ${emailError}`)
      }
    }

    // Log the event
    // Note: actorId references employees table, company users stored in meta
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "reminder_sent",
      message: `Job reminder sent for "${job.title}"`,
      meta: JSON.stringify({
        customerSent: results.customerSent,
        employeeSent: results.employeeSent,
        sentByUserId: session.id,
        sentByRole: session.role,
        timeUntil: timeUntilText,
      }),
      actorId: null,
    })

    return NextResponse.json({
      success: true,
      ...results,
      message: `Reminder sent to ${[
        results.customerSent && "customer",
        results.employeeSent && "employee",
      ].filter(Boolean).join(" and ") || "no one"}`,
    })
  } catch (error) {
    console.error("Send reminder error:", error)
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 })
  }
}
