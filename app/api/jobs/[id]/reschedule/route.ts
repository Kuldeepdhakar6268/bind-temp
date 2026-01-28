import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { sendJobRescheduledEmail } from "@/lib/email"

// POST /api/jobs/[id]/reschedule - Reschedule a job
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
      newDate, 
      newEndDate,
      reason,
      notifyCustomer = true,
      notifyEmployee = true,
      assignedTo,
    } = body

    if (!newDate) {
      return NextResponse.json({ error: "New date is required" }, { status: 400 })
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

    // Check job isn't completed or cancelled
    if (job.status === "completed") {
      return NextResponse.json({ error: "Cannot reschedule a completed job" }, { status: 400 })
    }

    if (job.status === "cancelled") {
      return NextResponse.json({ error: "Cannot reschedule a cancelled job" }, { status: 400 })
    }

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const originalDate = job.scheduledFor
    const newScheduledFor = new Date(newDate)
    const newScheduledEnd = newEndDate ? new Date(newEndDate) : null

    // Verify new assignee if provided
    let newAssignee = null
    if (assignedTo && assignedTo !== job.assignedTo) {
      newAssignee = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.id, assignedTo),
          eq(schema.employees.companyId, session.companyId)
        ),
      })

      if (!newAssignee) {
        return NextResponse.json({ error: "Assigned employee not found" }, { status: 404 })
      }
    }

    // Update job
    const updateData: any = {
      scheduledFor: newScheduledFor,
      updatedAt: new Date(),
    }

    if (newScheduledEnd) {
      updateData.scheduledEnd = newScheduledEnd
    }

    // If assignee is being changed, reset acceptance status
    if (assignedTo && assignedTo !== job.assignedTo) {
      updateData.assignedTo = assignedTo
      updateData.employeeAccepted = null
      updateData.employeeAcceptedAt = null
      updateData.status = "scheduled" // Reset status for new assignee
    } else if (assignedTo) {
      updateData.assignedTo = assignedTo
    }

    // Reset status to scheduled if it was in-progress (and not already set above)
    if (job.status === "in-progress" && !updateData.status) {
      updateData.status = "scheduled"
    }

    const [updatedJob] = await db
      .update(schema.jobs)
      .set(updateData)
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Log the event
    // Note: actorId references employees table, but company users are in users table
    // Store company user info in meta instead, set actorId to null for company actions
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "rescheduled",
      message: `Job "${job.title}" rescheduled from ${originalDate ? new Date(originalDate).toLocaleDateString() : 'unscheduled'} to ${newScheduledFor.toLocaleDateString()}`,
      meta: JSON.stringify({
        originalDate: originalDate?.toISOString(),
        newDate: newScheduledFor.toISOString(),
        reason,
        rescheduledByUserId: session.id,
        rescheduledByRole: session.role,
        newAssignee: assignedTo,
      }),
      actorId: null, // Company user, not an employee
    })

    // Build full address without duplicating city/postcode already in location
    const normalizeAddressPart = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, "")
    const addressParts: string[] = []
    if (job.location) {
      addressParts.push(job.location)
    }
    const normalizedBase = normalizeAddressPart(addressParts.join(", "))
    if (job.city && !normalizedBase.includes(normalizeAddressPart(job.city))) {
      addressParts.push(job.city)
    }
    const normalizedWithCity = normalizeAddressPart(addressParts.join(", "))
    if (job.postcode && !normalizedWithCity.includes(normalizeAddressPart(job.postcode))) {
      addressParts.push(job.postcode)
    }
    const fullAddress = addressParts.join(", ")

    // Send notification email to customer
    if (notifyCustomer && job.customer?.email) {
      try {
        await sendJobRescheduledEmail({
          to: job.customer.email,
          customerName: `${job.customer.firstName} ${job.customer.lastName}`,
          jobTitle: job.title,
          originalDate: originalDate ? new Date(originalDate) : null,
          newDate: newScheduledFor,
          reason: reason || "Schedule adjustment",
          companyName: company?.name || "Your Cleaning Company",
          location: fullAddress,
          durationMinutes: job.durationMinutes || 60,
        })
      } catch (emailError) {
        console.error("Failed to send reschedule email to customer:", emailError)
      }
    }

    // Send notification email to assigned employee
    const employeeToNotify = newAssignee || job.assignee
    if (notifyEmployee && employeeToNotify?.email) {
      try {
        await sendJobRescheduledEmail({
          to: employeeToNotify.email,
          customerName: `${employeeToNotify.firstName} ${employeeToNotify.lastName}`,
          jobTitle: job.title,
          originalDate: originalDate ? new Date(originalDate) : null,
          newDate: newScheduledFor,
          reason: reason || "Schedule adjustment",
          companyName: company?.name || "Your Company",
          location: fullAddress,
          durationMinutes: job.durationMinutes || 60,
          isEmployeeNotification: true,
          customerInfo: job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "",
        })
      } catch (emailError) {
        console.error("Failed to send reschedule email to employee:", emailError)
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: "Job rescheduled successfully",
      originalDate: originalDate?.toISOString(),
      newDate: newScheduledFor.toISOString(),
    })
  } catch (error) {
    console.error("Reschedule job error:", error)
    return NextResponse.json({ error: "Failed to reschedule job" }, { status: 500 })
  }
}
