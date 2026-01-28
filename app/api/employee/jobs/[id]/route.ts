import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, customers, employees, jobTasks, companies, cleaningPlans, jobCheckIns, invoices, jobAssignments } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { sendJobStartedEmail, sendJobCompletedEmail, sendJobCompletedToCompanyEmail } from "@/lib/email"
import { generateInvoiceFromJob } from "@/lib/invoice-utils"
import { generateInvoicePdfBuffer } from "@/lib/invoices-pdf"

/**
 * GET /api/employee/jobs/[id]
 * Get a specific job assigned to the employee
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Get job with limited customer info (no email/phone for privacy)
    const [result] = await db
      .select({
        job: jobs,
        assignment: jobAssignments,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          // Note: email and phone intentionally excluded for employee privacy
          address: customers.address,
          city: customers.city,
          postcode: customers.postcode,
          preferredContactMethod: customers.preferredContactMethod,
        },
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
        )
      )
      .limit(1)

    if (!result) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Get job tasks
    const tasks = await db
      .select()
      .from(jobTasks)
      .where(eq(jobTasks.jobId, jobId))
      .orderBy(jobTasks.order)

    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id),
      columns: {
        payType: true,
        hourlyRate: true,
      },
    })

    const employeePayType = employee?.payType || "hourly"
    const hourlyRate = employee?.hourlyRate ? parseFloat(employee.hourlyRate) : 0
    const computeHourlyPay = () => {
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return null
      let minutes = result.job.durationMinutes ?? null
      if (!minutes && result.job.scheduledFor && result.job.scheduledEnd) {
        const start = new Date(result.job.scheduledFor).getTime()
        const end = new Date(result.job.scheduledEnd).getTime()
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          minutes = Math.round((end - start) / 60000)
        }
      }
      if (!minutes || minutes <= 0) return null
      const pay = hourlyRate * (minutes / 60)
      return Number.isFinite(pay) && pay > 0 ? pay.toFixed(2) : null
    }

    let resolvedPay = result.assignment?.payAmount ?? result.job.employeePay ?? null
    if (employeePayType === "hourly" && !resolvedPay) {
      resolvedPay = computeHourlyPay()
    }
    if (employeePayType === "salary") {
      resolvedPay = null
    }

    return NextResponse.json({
      ...result.job,
      employeePay: resolvedPay,
      employeeAccepted: result.assignment?.status === "accepted" ? 1 : 0,
      customer: result.customer ? {
        id: result.customer.id,
        name: `${result.customer.firstName} ${result.customer.lastName}`,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName,
        // Note: email and phone excluded for privacy - employees only need address for navigation
        address: result.customer.address,
        city: result.customer.city,
        postcode: result.customer.postcode,
      } : null,
      employeePayType,
      tasks,
    })
  } catch (error) {
    console.error("Error fetching job:", error)
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 })
  }
}

/**
 * PATCH /api/employee/jobs/[id]
 * Update job status (start, complete, add notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Verify job belongs to employee
    const [assignmentResult] = await db
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
          ne(jobAssignments.status, "declined"),
        )
      )
      .limit(1)

    const existingJob = assignmentResult?.job

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const body = await request.json()
    const { action, notes } = body

    let updateData: Record<string, any> = {
      updatedAt: new Date(),
    }


    // Get customer and company info for emails
    const [jobWithDetails] = await db
      .select({
        customer: {
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
        },
        company: {
          name: companies.name,
          email: companies.email,
          phone: companies.phone,
        },
        plan: {
          price: cleaningPlans.price,
        },
      })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .leftJoin(cleaningPlans, eq(jobs.planId, cleaningPlans.id))
      .where(eq(jobs.id, jobId))
      .limit(1)

    const allowJobUpdates = isCompanyNotificationEnabled(jobWithDetails?.company?.notificationSettings, "jobUpdates")

    // Get employee name for emails
    const [employeeInfo] = await db
      .select({ firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(eq(employees.id, session.id))
      .limit(1)

    const employeeName = employeeInfo ? `${employeeInfo.firstName} ${employeeInfo.lastName}` : null

    if (action === "start") {
      updateData.status = "in_progress"
      updateData.startedAt = new Date()

      // Send job started email to customer
      if (existingJob.status === "scheduled" && jobWithDetails?.customer?.email) {
        try {
          await sendJobStartedEmail({
            to: jobWithDetails.customer.email,
            customerName: `${jobWithDetails.customer.firstName} ${jobWithDetails.customer.lastName}`,
            jobTitle: existingJob.title,
            jobDescription: existingJob.description || "",
            startedAt: new Date(),
            estimatedDuration: existingJob.durationMinutes || 120,
            location: existingJob.location || "",
            employeeName: employeeName || "Your cleaner",
            companyName: jobWithDetails.company?.name || "Our cleaning team",
            companyPhone: jobWithDetails.company?.phone || "",
          })
        } catch (emailError) {
          console.error("Failed to send job started email:", emailError)
        }
      }
    } else if (action === "complete") {
      // Check if all tasks are completed before allowing job completion
      const tasks = await db
        .select()
        .from(jobTasks)
        .where(eq(jobTasks.jobId, jobId))

      if (tasks.length > 0) {
        const incompleteTasks = tasks.filter(t => t.status !== "completed")
        if (incompleteTasks.length > 0) {
          return NextResponse.json({ 
            error: `Cannot complete job: ${incompleteTasks.length} task(s) still pending. Please complete all tasks first.`,
            incompleteTasks: incompleteTasks.map(t => t.title)
          }, { status: 400 })
        }
      }

      const completionTimestamp = new Date()
      const wasCompleted = existingJob.status === "completed"
      await db
        .update(jobAssignments)
        .set({
          status: "completed",
          completedAt: completionTimestamp,
          updatedAt: completionTimestamp,
        })
        .where(
          and(
            eq(jobAssignments.jobId, jobId),
            eq(jobAssignments.employeeId, session.id)
          )
        )

      const allAssignments = await db.query.jobAssignments.findMany({
        where: and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.companyId, session.companyId),
        ),
      })
      const allCompleted =
        allAssignments.length > 0 &&
        allAssignments.every((assignment) => assignment.status === "completed")

      if (allCompleted) {
        updateData.status = "completed"
        updateData.completedAt = existingJob.completedAt ? new Date(existingJob.completedAt) : completionTimestamp
      } else if (existingJob.status === "scheduled") {
        updateData.status = "in_progress"
      }

      // Auto check-out to capture completion time (if not already checked out)
      const existingCheckOut = await db
        .select({ id: jobCheckIns.id })
        .from(jobCheckIns)
        .where(
          and(
            eq(jobCheckIns.jobId, jobId),
            eq(jobCheckIns.employeeId, session.id),
            eq(jobCheckIns.type, "check_out")
          )
        )
        .limit(1)

      if (existingCheckOut.length === 0) {
        await db.insert(jobCheckIns).values({
          companyId: existingJob.companyId,
          jobId,
          employeeId: session.id,
          type: "check_out",
          latitude: "0",
          longitude: "0",
          locationAccuracy: null,
          capturedAddress: "Auto check-out on completion",
          distanceFromJobSite: null,
          isWithinRange: 0,
          deviceType: "system",
          deviceModel: null,
          userAgent: request.headers.get("user-agent") || null,
          checkedAt: new Date(),
        })
      }

      if (allCompleted && !wasCompleted) {
        // Send job completed email to customer
        if (jobWithDetails?.customer?.email) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
            const planPrice = jobWithDetails?.plan?.price ? parseFloat(jobWithDetails.plan.price) : 0
            const emailPrice = existingJob.actualPrice || existingJob.estimatedPrice || (planPrice ? planPrice.toFixed(2) : "0")
            let invoiceForEmail = await db.query.invoices.findFirst({
              where: and(
                eq(invoices.companyId, existingJob.companyId),
                eq(invoices.jobId, jobId),
              ),
              orderBy: (table, { desc: descOrder }) => [descOrder(table.id)],
            })

            if (!invoiceForEmail) {
              try {
                invoiceForEmail = await generateInvoiceFromJob({
                  companyId: existingJob.companyId,
                  jobId,
                })

                // Ensure the invoice is marked as sent.
                await db
                  .update(invoices)
                  .set({
                    status: "sent",
                    amountDue: invoiceForEmail.total,
                    updatedAt: new Date(),
                  })
                  .where(eq(invoices.id, invoiceForEmail.id))
              } catch (invoiceError) {
                console.error("Failed to generate invoice on job completion:", invoiceError)
                invoiceForEmail = null
              }
            }

            let pdfBuffer: Buffer | undefined
            if (invoiceForEmail) {
              try {
                pdfBuffer = await generateInvoicePdfBuffer(invoiceForEmail.id, existingJob.companyId)
              } catch (pdfError) {
                console.error("Failed to generate invoice PDF on job completion:", pdfError)
              }
            }

            // Only show "Pay Now" when the invoice PDF is attached.
            const paymentUrl = pdfBuffer ? `${baseUrl}/portal/dashboard` : undefined

            await sendJobCompletedEmail({
              to: jobWithDetails.customer.email,
              customerName: `${jobWithDetails.customer.firstName} ${jobWithDetails.customer.lastName}`,
              jobTitle: existingJob.title,
              jobDescription: existingJob.description || "",
              completedDate: new Date(),
              durationMinutes: existingJob.durationMinutes || 120,
              actualPrice: emailPrice,
              currency: existingJob.currency || "GBP",
              employeeName: employeeName || "Your cleaner",
              companyName: jobWithDetails.company?.name || "Our cleaning team",
              feedbackUrl: `${baseUrl}/portal/dashboard`,
              paymentUrl,
              invoiceNumber: invoiceForEmail?.invoiceNumber || null,
              pdfBuffer,
            })
            console.log(`Job completed email sent to customer: ${jobWithDetails.customer.email}`)
          } catch (emailError) {
            console.error("Failed to send job completed email to customer:", emailError)
          }
        }

        // Send job completed notification to company
        if (jobWithDetails?.company?.email && allowJobUpdates) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
            const planPrice = jobWithDetails?.plan?.price ? parseFloat(jobWithDetails.plan.price) : 0
            const emailPrice = existingJob.actualPrice || existingJob.estimatedPrice || (planPrice ? planPrice.toFixed(2) : "0")
            await sendJobCompletedToCompanyEmail({
              companyEmail: jobWithDetails.company.email,
              companyName: jobWithDetails.company.name || "Company",
              jobId,
              jobTitle: existingJob.title,
              customerName: `${jobWithDetails.customer?.firstName || ""} ${jobWithDetails.customer?.lastName || ""}`.trim() || "Customer",
              customerEmail: jobWithDetails.customer?.email || "",
              employeeName: employeeName || "Cleaner",
              completedDate: new Date(),
              durationMinutes: existingJob.durationMinutes || null,
              actualPrice: emailPrice,
              currency: "EUR",
              location: existingJob.location || null,
              dashboardUrl: baseUrl,
            })
            console.log(`Job completed email sent to company: ${jobWithDetails.company.email}`)
          } catch (emailError) {
            console.error("Failed to send job completed email to company:", emailError)
          }
        }
      }
    } else if (action === "pause") {
      updateData.status = "paused"
    } else if (action === "reject") {
      if (existingJob.status === "completed" || existingJob.status === "rejected") {
        return NextResponse.json({ error: "Job is already completed or rejected." }, { status: 400 })
      }
      updateData.status = "rejected"
      updateData.rejectedAt = new Date()
    }

    if (notes !== undefined) {
      updateData.internalNotes = notes
    }

    const [updatedJob] = await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, jobId))
      .returning()

    return NextResponse.json(updatedJob)
  } catch (error) {
    console.error("Error updating job:", error)
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 })
  }
}
