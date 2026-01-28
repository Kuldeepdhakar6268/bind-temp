import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, customers, companies, employees, users, cleaningPlans, jobAssignments } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { 
  sendJobConfirmationEmail, 
  sendJobDeclinedNotification,
  sendJobReassignedAcceptedNotification
} from "@/lib/email"

/**
 * POST /api/employee/jobs/[id]/accept
 * Employee accepts an assigned job
 * Once accepted, send confirmation to customer
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    const database = db

    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Get the job assignment for this employee
    const [assignmentResult] = await database
      .select({
        job: jobs,
        assignment: jobAssignments,
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
        )
      )
      .limit(1)

    const job = assignmentResult?.job
    const assignment = assignmentResult?.assignment

    if (!job || !assignment) {
      return NextResponse.json({ error: "Job not found or not assigned to you" }, { status: 404 })
    }

    // Check if already accepted
    if (assignment.status === "accepted" || assignment.status === "completed") {
      return NextResponse.json({ 
        error: "You have already accepted this job",
        alreadyAccepted: true 
      }, { status: 400 })
    }

    // Update assignment to mark as accepted by employee
    await database
      .update(jobAssignments)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id)
        )
      )

    const allAssignments = await database.query.jobAssignments.findMany({
      where: and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.companyId, session.companyId),
      ),
    })
    const allAccepted =
      allAssignments.length > 0 &&
      allAssignments.every((item) => item.status === "accepted" || item.status === "completed")

    let updatedJob = job
    if (allAccepted) {
      const [jobUpdate] = await database
        .update(jobs)
        .set({
          employeeAccepted: 1,
          employeeAcceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId))
        .returning()
      if (jobUpdate) {
        updatedJob = jobUpdate
      }
    }

    // Now that employee has accepted, send confirmation to customer
    // Get customer, company, and employee details
    const customer = job.customerId ? await database.query.customers.findFirst({
      where: eq(customers.id, job.customerId)
    }) : null

    const company = await database.query.companies.findFirst({
      where: eq(companies.id, session.companyId)
    })

    const employee = await database.query.employees.findFirst({
      where: eq(employees.id, session.id)
    })

    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : null

    // Send job confirmation to customer once ALL assigned employees accept
    if (allAccepted && customer?.email && company && updatedJob.customerConfirmationSent !== 1) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
        const location = [job.location, job.city, job.postcode].filter(Boolean).join(", ")
        const plan = job.planId
          ? await database.query.cleaningPlans.findFirst({
              where: eq(cleaningPlans.id, job.planId),
            })
          : null
        const resolvedEstimatedPrice = job.estimatedPrice ?? plan?.price ?? "0"
        
        await sendJobConfirmationEmail({
          to: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          jobTitle: job.title,
          jobDescription: job.description || "",
          scheduledDate: job.scheduledFor,
          scheduledEndDate: job.scheduledEnd,
          durationMinutes: job.durationMinutes || 120,
          location: job.location || "",
          city: job.city || "",
          postcode: job.postcode || "",
          accessInstructions: job.accessInstructions || "",
          estimatedPrice: resolvedEstimatedPrice || "0",
          currency: job.currency || "GBP",
          employeeName,
          companyName: company.name,
          companyPhone: company.phone || "",
          companyEmail: company.email || "",
          customMessage: null,
          jobUrl: `${baseUrl}/portal/dashboard`,
          rescheduleUrl: `${baseUrl}/portal/dashboard`,
        })
        console.log(`Job confirmation email sent to customer: ${customer.email}`)

        // Update job to mark confirmation as sent
        await database
          .update(jobs)
          .set({
            customerConfirmationSent: 1,
            customerConfirmationSentAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(jobs.id, jobId))

      } catch (emailError) {
        console.error("Failed to send job confirmation email:", emailError)
        // Don't fail the acceptance if email fails
      }
    }

    // Also notify company admins that the job has been accepted (once all accept)
    if (company && allAccepted) {
      const allowEmployeeUpdates = isCompanyNotificationEnabled(company.notificationSettings, "employeeUpdates")
      if (allowEmployeeUpdates) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
          const jobUrl = `${baseUrl}/job/${jobId}`

          // Get admin users
          const adminUsers = await database
            .select()
            .from(users)
            .where(eq(users.companyId, session.companyId))
            .limit(5)

          // Send notification to each admin
          for (const admin of adminUsers) {
            if (admin.email) {
              await sendJobReassignedAcceptedNotification({
                to: admin.email,
                adminName: admin.firstName || "Admin",
                employeeName: employeeName || "Employee",
                jobTitle: job.title,
                jobId: job.id,
                customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
                scheduledDate: job.scheduledFor,
                companyName: company.name,
                jobUrl,
              })
            }
          }
          console.log(`Job accepted notification sent to company admins`)
        } catch (emailError) {
          console.error("Failed to send job accepted notification to company:", emailError)
          // Don't fail the acceptance if email fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: allAccepted
        ? "Job accepted successfully! Customer has been notified."
        : "Job accepted. Waiting for the rest of the team to confirm.",
      job: updatedJob,
      awaitingOthers: !allAccepted,
    })
  } catch (error) {
    console.error("Error accepting job:", error)
    return NextResponse.json(
      { error: "Failed to accept job" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employee/jobs/[id]/accept
 * Employee declines/rejects an assigned job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    const database = db

    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    // Get the job assignment for this employee
    const [assignmentResult] = await database
      .select({
        job: jobs,
        assignment: jobAssignments,
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
        )
      )
      .limit(1)

    const job = assignmentResult?.job
    const assignment = assignmentResult?.assignment

    if (!job || !assignment) {
      return NextResponse.json({ error: "Job not found or not assigned to you" }, { status: 404 })
    }

    if (job.status === "completed") {
      return NextResponse.json({ error: "Completed jobs cannot be declined." }, { status: 400 })
    }

    await database
      .update(jobAssignments)
      .set({
        status: "declined",
        acceptedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id)
        )
      )

    const remainingAssignments = await database.query.jobAssignments.findMany({
      where: and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.companyId, session.companyId),
      ),
    })
    const activeAssignments = remainingAssignments.filter(
      (item) => item.status !== "declined"
    )

    const nextAssignedTo = activeAssignments[0]?.employeeId ?? null

    const declineNote = reason
      ? `[Job Declined by Employee - ${new Date().toISOString()}]\nReason: ${reason}`
      : `[Job Declined by Employee - ${new Date().toISOString()}]`

    const [updatedJob] = await database
      .update(jobs)
      .set({
        assignedTo: nextAssignedTo,
        employeeAccepted: 0,
        employeeAcceptedAt: null,
        status: activeAssignments.length === 0 ? "pending" : job.status,
        internalNotes: job.internalNotes ? `${job.internalNotes}\n\n${declineNote}` : declineNote,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .returning()

    // Notify employer about declined job
    const adminUsers = await database
      .select()
      .from(users)
      .where(eq(users.companyId, session.companyId))
      .limit(5)

    const employee = await database.query.employees.findFirst({
      where: eq(employees.id, session.id)
    })

    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "Employee"

    // Get customer and company for notification
    const customer = job.customerId ? await database.query.customers.findFirst({
      where: eq(customers.id, job.customerId)
    }) : null

    const company = await database.query.companies.findFirst({
      where: eq(companies.id, session.companyId)
    })

    // Send notification email to admin about declined job
    if (company) {
      const allowEmployeeUpdates = isCompanyNotificationEnabled(company.notificationSettings, "employeeUpdates")
      if (allowEmployeeUpdates) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
          const jobUrl = `${baseUrl}/job/${jobId}`

          for (const admin of adminUsers) {
            if (admin.email) {
              await sendJobDeclinedNotification({
                to: admin.email,
                adminName: admin.firstName || "Admin",
                employeeName,
                jobTitle: job.title,
                jobId: job.id,
                customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
                scheduledDate: job.scheduledFor,
                declineReason: reason || null,
                companyName: company.name,
                jobUrl,
              })
            }
          }
          console.log(`Job declined notification sent to company admins`)
        } catch (emailError) {
          console.error("Failed to send job declined notification:", emailError)
          // Don't fail the decline if email fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Job declined. The employer has been notified.",
      job: updatedJob,
    })
  } catch (error) {
    console.error("Error declining job:", error)
    return NextResponse.json(
      { error: "Failed to decline job" },
      { status: 500 }
    )
  }
}
