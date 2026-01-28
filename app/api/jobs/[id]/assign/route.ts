import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { sendJobAssignmentEmail } from "@/lib/email"

// POST /api/jobs/[id]/assign - Assign employee to job
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
    const { employeeId, teamMembers, sendNotification = true, notes } = body

    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 })
    }

    // Verify job exists and belongs to company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
      with: {
        customer: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.status === "completed") {
      return NextResponse.json(
        { error: "Completed jobs cannot be reassigned here. Use Edit Job to confirm the change." },
        { status: 400 },
      )
    }

    // Verify employee belongs to company
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.id, employeeId),
        eq(schema.employees.companyId, session.companyId)
      ),
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Get company info for email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    // Update job assignment - reset acceptance status for new employee
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        assignedTo: employeeId,
        teamMembers: teamMembers || null,
        // Reset employee acceptance so new assignee sees Accept/Decline buttons
        employeeAccepted: null,
        employeeAcceptedAt: null,
        // Set status back to scheduled (was pending after decline)
        status: "scheduled",
        internalNotes: notes ? `${job.internalNotes || ""}\n\nAssignment note: ${notes}` : job.internalNotes,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    // Log the assignment event using jobEvents table
    await db.insert(schema.jobEvents).values({
      jobId: jobId,
      type: "job_assigned",
      message: `Job "${job.title}" assigned to ${employee.firstName} ${employee.lastName}`,
      meta: JSON.stringify({
        jobId,
        employeeId,
        previousAssignee: job.assignedTo,
        assignedBy: session.id,
      }),
      actorId: null,
    })

    // Send notification email to employee
    const customer = job.customer as any
    if (sendNotification && employee.email) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
        const normalizeAddressPart = (value: string) =>
          value.toLowerCase().replace(/[^a-z0-9]/g, "")
        const addressParts: string[] = []
        if (job.location) {
          addressParts.push(job.location)
        }
        const normalizedBase = normalizeAddressPart(addressParts.join(", "))
        if (job.addressLine2 && !normalizedBase.includes(normalizeAddressPart(job.addressLine2))) {
          addressParts.push(job.addressLine2)
        }
        const normalizedAddress = normalizeAddressPart(addressParts.join(", "))
        if (job.city && !normalizedAddress.includes(normalizeAddressPart(job.city))) {
          addressParts.push(job.city)
        }
        const normalizedAddressWithCity = normalizeAddressPart(addressParts.join(", "))
        if (job.postcode && !normalizedAddressWithCity.includes(normalizeAddressPart(job.postcode))) {
          addressParts.push(job.postcode)
        }
        const fullAddress = addressParts.join(", ")
        
        await sendJobAssignmentEmail({
          employeeEmail: employee.email,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          jobTitle: job.title,
          jobDescription: job.description || "",
          customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
          customerPhone: customer?.phone || null,
          address: fullAddress,
          scheduledDate: job.scheduledFor ? new Date(job.scheduledFor) : new Date(),
          scheduledTime: job.scheduledFor ? new Date(job.scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
          estimatedDuration: job.durationMinutes ? `${job.durationMinutes} minutes` : null,
          specialInstructions: job.accessInstructions || null,
          companyName: company?.name || "Your Company",
          jobUrl: `${baseUrl}/employee/jobs/${jobId}`,
        })
      } catch (emailError) {
        console.error("Failed to send assignment email:", emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: `Job assigned to ${employee.firstName} ${employee.lastName}`,
    })
  } catch (error) {
    console.error("Assign job error:", error)
    return NextResponse.json({ error: "Failed to assign job" }, { status: 500 })
  }
}
