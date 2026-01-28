import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobCheckIns, jobs, employees, customers, companies, users, invoices, invoiceItems, cleaningPlans, jobEvents, jobAssignments } from "@/lib/db/schema"
import { eq, and, desc, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { 
  sendJobStartedEmail, 
  sendJobCompletedEmail, 
  sendEmployerCheckInNotification, 
  sendEmployerCheckOutNotification,
  sendInvoiceWithPDFEmail 
} from "@/lib/email"
import { generateInvoicePDF } from "@/lib/pdf-generator"

// Maximum distance in meters to be considered "at the job site"
const MAX_CHECK_IN_DISTANCE = 200 // 200 meters

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

/**
 * GET /api/employee/jobs/[id]/check-in
 * Get check-in status for a job
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

    const assignment = await db.query.jobAssignments.findFirst({
      where: and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.employeeId, session.id),
        eq(jobAssignments.companyId, session.companyId),
        ne(jobAssignments.status, "declined"),
      ),
    })

    if (!assignment) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Get all check-ins for this job by this employee
    const checkIns = await db
      .select()
      .from(jobCheckIns)
      .where(
        and(
          eq(jobCheckIns.jobId, jobId),
          eq(jobCheckIns.employeeId, session.id)
        )
      )
      .orderBy(desc(jobCheckIns.checkedAt))

    const lastCheckIn = checkIns.find((c) => c.type === "check_in")
    const lastCheckOut = checkIns.find((c) => c.type === "check_out")

    // Determine current status
    let status = "not_checked_in"
    if (lastCheckIn && (!lastCheckOut || new Date(lastCheckIn.checkedAt) > new Date(lastCheckOut.checkedAt))) {
      status = "checked_in"
    } else if (lastCheckOut) {
      status = "checked_out"
    }

    // Calculate total time on site
    let totalTimeOnSite = 0
    const sortedCheckIns = [...checkIns].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    )

    let currentCheckIn: typeof checkIns[0] | null = null
    for (const record of sortedCheckIns) {
      if (record.type === "check_in") {
        currentCheckIn = record
      } else if (record.type === "check_out" && currentCheckIn) {
        totalTimeOnSite +=
          new Date(record.checkedAt).getTime() -
          new Date(currentCheckIn.checkedAt).getTime()
        currentCheckIn = null
      }
    }

    // If currently checked in, add time until now
    if (status === "checked_in" && lastCheckIn) {
      totalTimeOnSite += Date.now() - new Date(lastCheckIn.checkedAt).getTime()
    }

    // Check if already has check-in/check-out (one-time actions)
    const hasCheckedIn = checkIns.some((c) => c.type === "check_in")
    const hasCheckedOut = checkIns.some((c) => c.type === "check_out")

    // Calculate job duration (only if both check-in and check-out exist)
    let jobDuration: number | null = null
    if (hasCheckedIn && hasCheckedOut && lastCheckIn && lastCheckOut) {
      const checkInTime = new Date(lastCheckIn.checkedAt).getTime()
      const checkOutTime = new Date(lastCheckOut.checkedAt).getTime()
      jobDuration = Math.floor((checkOutTime - checkInTime) / 1000 / 60) // Minutes
    }

    return NextResponse.json({
      status,
      lastCheckIn,
      lastCheckOut,
      totalTimeOnSite: Math.floor(totalTimeOnSite / 1000 / 60), // Minutes
      checkIns,
      hasCheckedIn,
      hasCheckedOut,
      jobDuration, // Total job duration in minutes (check-out - check-in)
    })
  } catch (error) {
    console.error("Error fetching check-in status:", error)
    return NextResponse.json({ error: "Failed to fetch check-in status" }, { status: 500 })
  }
}

/**
 * POST /api/employee/jobs/[id]/check-in
 * Check in or check out of a job
 */
export async function POST(
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

    const body = await request.json()
    const {
      type, // 'check_in' or 'check_out'
      latitude,
      longitude,
      locationAccuracy,
      capturedAddress,
      deviceType,
      deviceModel,
      comment,
    } = body

    const trimmedComment = typeof comment === "string" ? comment.trim().slice(0, 1000) : ""

    if (!type || !["check_in", "check_out"].includes(type)) {
      return NextResponse.json({ error: "Invalid check-in type" }, { status: 400 })
    }

    // Allow check-in even if location is unavailable (lat/lng can be 0 or empty)
    const hasLocation = latitude !== undefined && longitude !== undefined

    // Verify job belongs to employee
    const [jobResult] = await db
      .select({
        job: jobs,
        plan: {
          price: cleaningPlans.price,
        },
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .leftJoin(cleaningPlans, eq(jobs.planId, cleaningPlans.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
        )
      )
      .limit(1)

    if (!jobResult) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }
    const job = jobResult.job
    const planPriceValue = jobResult.plan?.price ? parseFloat(jobResult.plan.price) : 0

    // Check for existing check-ins/check-outs - only ONE allowed each
    const existingCheckIns = await db
      .select()
      .from(jobCheckIns)
      .where(
        and(
          eq(jobCheckIns.jobId, jobId),
          eq(jobCheckIns.employeeId, session.id)
        )
      )

    const hasCheckedIn = existingCheckIns.some((c) => c.type === "check_in")
    const hasCheckedOut = existingCheckIns.some((c) => c.type === "check_out")

    if (type === "check_in" && hasCheckedIn) {
      return NextResponse.json({ 
        error: "You have already checked in to this job. Check-in can only be done once." 
      }, { status: 400 })
    }

    if (type === "check_out") {
      if (!hasCheckedIn) {
        return NextResponse.json({ 
          error: "You must check in before checking out." 
        }, { status: 400 })
      }
      if (hasCheckedOut) {
        return NextResponse.json({ 
          error: "You have already checked out from this job. Check-out can only be done once." 
        }, { status: 400 })
      }
    }

    // Calculate distance from job site (if job has location)
    let distanceFromJobSite: number | null = null
    let isWithinRange = false

    // Check if we have valid coordinates (not 0,0)
    const hasValidLocation = hasLocation && 
      parseFloat(latitude) !== 0 && 
      parseFloat(longitude) !== 0

    // For now, we'll mark as within range if we have coordinates
    // In production, you'd geocode the job address to get lat/lng
    if (hasValidLocation) {
      // If job has coordinates stored, calculate distance
      // For now, assume within range since we don't have job coordinates yet
      isWithinRange = true
      distanceFromJobSite = 0
    }

    // Create check-in record
    const [checkIn] = await db
      .insert(jobCheckIns)
      .values({
        companyId: session.companyId,
        jobId,
        employeeId: session.id,
        type,
        latitude: latitude || "0",
        longitude: longitude || "0",
        locationAccuracy: locationAccuracy || null,
        capturedAddress: capturedAddress || (hasValidLocation ? null : "Location unavailable"),
        distanceFromJobSite: distanceFromJobSite?.toString() || null,
        isWithinRange: isWithinRange ? 1 : 0,
        deviceType: deviceType || null,
        deviceModel: deviceModel || null,
        userAgent: request.headers.get("user-agent") || null,
        checkedAt: new Date(),
      })
      .returning()

    // Update job status based on check-in type
    if (type === "check_in" && job.status === "scheduled") {
      await db
        .update(jobs)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(jobs.id, jobId))
    }

    let allAssignmentsCompleted = false
    const wasCompleted = job.status === "completed"

    // Mark assignment as completed on check-out (job completes when all assigned employees finish)
    if (type === "check_out") {
      const completedAt = new Date()
      await db
        .update(jobAssignments)
        .set({
          status: "completed",
          completedAt,
          updatedAt: completedAt,
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
      allAssignmentsCompleted =
        allAssignments.length > 0 &&
        allAssignments.every((assignment) => assignment.status === "completed")

      if (allAssignmentsCompleted && !wasCompleted) {
        await db
          .update(jobs)
          .set({ status: "completed", completedAt, updatedAt: completedAt })
          .where(eq(jobs.id, jobId))
      }

      if (trimmedComment) {
        await db.insert(jobEvents).values({
          jobId,
          actorId: session.id,
          type: "check_out_comment",
          message: "Cleaner left a check-out comment.",
          meta: JSON.stringify({ comment: trimmedComment }),
        })
      }
    }

    // Send email notifications to customer AND employer
    try {
      // Get customer and company info
      const customer = job.customerId ? await db.query.customers.findFirst({
        where: eq(customers.id, job.customerId)
      }) : null

      const company = await db.query.companies.findFirst({
        where: eq(companies.id, session.companyId)
      })

      const allowEmployeeUpdates = isCompanyNotificationEnabled(company?.notificationSettings, "employeeUpdates")

      const employee = await db.query.employees.findFirst({
        where: eq(employees.id, session.id)
      })

      // Get employer/admin users to notify
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, session.companyId))
        .limit(5) // Get up to 5 admin users

      if (customer?.email && company) {
        const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "Your cleaner"
        const customerName = `${customer.firstName} ${customer.lastName}`
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
        const location = addressParts.join(", ")
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"

        if (type === "check_in" && job.status === "scheduled") {
          // Send job started notification to CUSTOMER
          await sendJobStartedEmail({
            to: customer.email,
            customerName,
            jobTitle: job.title,
            jobDescription: job.description || "",
            startedAt: new Date(),
            estimatedDuration: job.durationMinutes || 120,
            location,
            employeeName,
            companyName: company.name,
            companyPhone: company.phone || "",
            trackingUrl: `${baseUrl}/portal/dashboard`,
          })
          console.log(`Job started email sent to customer: ${customer.email}`)

          // Send check-in notification to EMPLOYER/ADMIN
          if (allowEmployeeUpdates) {
            for (const adminUser of adminUsers) {
              if (adminUser.email) {
                try {
                  await sendEmployerCheckInNotification({
                    employerEmail: adminUser.email,
                    employerName: adminUser.firstName,
                    employeeName,
                    customerName,
                    jobTitle: job.title,
                    jobId: job.id,
                    checkInTime: new Date(),
                    location,
                    companyName: company.name,
                    dashboardUrl: `${baseUrl}/job/${job.id}`,
                  })
                  console.log(`Check-in notification sent to employer: ${adminUser.email}`)
                } catch (e) {
                  console.error(`Failed to send check-in notification to ${adminUser.email}:`, e)
                }
              }
            }
          }

        } else if (type === "check_out") {
          // Calculate job duration from check-in to check-out
          const checkInRecord = existingCheckIns.find(c => c.type === "check_in")
          const jobDuration = checkInRecord 
            ? Math.floor((Date.now() - new Date(checkInRecord.checkedAt).getTime()) / 1000 / 60)
            : job.durationMinutes || 120

          if (allAssignmentsCompleted && !wasCompleted) {

          // Create invoice automatically
          let invoice = null
          let invoiceItemsList: Array<{ title: string; description: string | null; quantity: string; unitPrice: string; amount: string }> = []
          let pdfBuffer: Buffer | undefined
          
          try {
            // Generate invoice number
            const lastInvoice = await db
              .select({ invoiceNumber: invoices.invoiceNumber })
              .from(invoices)
              .where(eq(invoices.companyId, session.companyId))
              .orderBy(desc(invoices.id))
              .limit(1)

            const formatDate = (date: Date) => {
              const dd = String(date.getDate()).padStart(2, "0")
              const mm = String(date.getMonth() + 1).padStart(2, "0")
              const yyyy = date.getFullYear()
              return `${dd}-${mm}-${yyyy}`
            }

            let invoiceNumber = "INV-0001"
            if (lastInvoice.length > 0) {
              const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split("-")[1])
              invoiceNumber = `INV-${String(lastNumber + 1).padStart(4, "0")}`
            }
            const invoiceDate = job.scheduledFor ? new Date(job.scheduledFor) : new Date()
            const customerNameLabel = `${customer.firstName} ${customer.lastName}`.trim()
            invoiceNumber = `${invoiceNumber} - ${customerNameLabel} - ${formatDate(invoiceDate)}`

            // Calculate price
            const price = parseFloat(job.actualPrice || job.estimatedPrice || (planPriceValue ? planPriceValue.toFixed(2) : "0"))
            const taxRate = 0 // Can be configured per company
            const taxAmount = (price * taxRate) / 100
            const total = price + taxAmount

            // Create the invoice
            const [newInvoice] = await db
              .insert(invoices)
              .values({
                companyId: session.companyId,
                invoiceNumber,
                customerId: customer.id,
                jobId: job.id,
                subtotal: price.toFixed(2),
                taxRate: taxRate.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                discountAmount: "0",
                total: total.toFixed(2),
                amountDue: total.toFixed(2),
                status: "sent",
                issuedAt: new Date(),
                dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Due in 14 days
                notes: `Service completed on ${new Date().toLocaleDateString("en-GB")}`,
              })
              .returning()

            invoice = newInvoice

            // Create invoice item
            invoiceItemsList = [{
              title: job.title,
              description: job.description,
              quantity: "1",
              unitPrice: price.toFixed(2),
              amount: price.toFixed(2),
            }]

            await db.insert(invoiceItems).values({
              invoiceId: invoice.id,
              title: job.title,
              description: job.description,
              quantity: "1",
              unitPrice: price.toFixed(2),
              amount: price.toFixed(2),
              sortOrder: 0,
            })

            console.log(`Invoice ${invoiceNumber} created for job ${job.id}`)
          } catch (invoiceError) {
            console.error("Failed to create invoice:", invoiceError)
          }

          // Generate PDF and send invoice email
          if (invoice) {
            try {
              const dueDateDate = invoice.dueAt ? new Date(invoice.dueAt) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
              const dueDateLabel = dueDateDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

              // Generate PDF
              const pdfDoc = generateInvoicePDF({
                invoiceNumber: invoice.invoiceNumber,
                issuedAt: invoice.issuedAt?.toISOString() || null,
                dueAt: invoice.dueAt?.toISOString() || null,
                status: invoice.status,
                company: {
                  name: company.name,
                  email: company.email || "",
                  phone: company.phone,
                  address: company.address,
                  city: company.city,
                  postcode: company.postcode,
                },
                customer: {
                  name: customerName,
                  email: customer.email || "",
                  phone: customer.phone,
                  address: customer.address,
                  city: customer.city,
                  postcode: customer.postcode,
                },
                items: invoiceItemsList,
                subtotal: invoice.subtotal || "0",
                taxRate: invoice.taxRate || "0",
                taxAmount: invoice.taxAmount || "0",
                discountAmount: invoice.discountAmount || "0",
                total: invoice.total || "0",
                notes: invoice.notes,
                terms: invoice.terms,
              })

              // Convert PDF to buffer
              pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"))

              // Send sleek invoice email with PDF
              await sendInvoiceWithPDFEmail({
                customerEmail: customer.email,
                customerName,
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.total || "0",
                invoiceItems: invoiceItemsList,
                subtotal: invoice.subtotal || "0",
                taxRate: invoice.taxRate || "0",
                taxAmount: invoice.taxAmount || "0",
                discountAmount: invoice.discountAmount || "0",
                total: invoice.total || "0",
                currency: job.currency || "GBP",
                dueDate: dueDateDate,
                jobTitle: job.title,
                completedDate: new Date(),
                employeeName,
                companyName: company.name,
                companyEmail: company.email,
                companyPhone: company.phone,
                companyAddress: company.address,
                companyCity: company.city,
                companyPostcode: company.postcode,
                paymentUrl: `${baseUrl}/portal/dashboard`,
                invoiceUrl: `${baseUrl}/portal/dashboard`,
                viewUrl: `${baseUrl}/portal/dashboard`,
                dueDateLabel,
                pdfBuffer,
              })
              console.log(`Invoice email with PDF sent to customer: ${customer.email}`)
            } catch (emailError) {
              console.error("Failed to send invoice email:", emailError)
              
              // Fallback: Send simple job completed email
              const feedbackUrl = `${baseUrl}/feedback/${jobId}`
              const photosUrl = `${baseUrl}/portal/jobs/${jobId}/photos`
              
              const emailPrice = job.actualPrice || job.estimatedPrice || (planPriceValue ? planPriceValue.toFixed(2) : "0")
              await sendJobCompletedEmail({
                to: customer.email,
                customerName,
                jobTitle: job.title,
                jobDescription: job.description || "",
                completedDate: new Date(),
                durationMinutes: jobDuration,
                actualPrice: emailPrice,
                currency: job.currency || "GBP",
                employeeName,
                companyName: company.name,
                feedbackUrl,
                photosUrl,
                photoCount: 0,
                paymentUrl: pdfBuffer ? `${baseUrl}/portal/dashboard` : undefined,
                invoiceNumber: invoice?.invoiceNumber || null,
                pdfBuffer,
              })
            }
          } else {
            // No invoice created, send standard job completed email
            const feedbackUrl = `${baseUrl}/feedback/${jobId}`
            const photosUrl = `${baseUrl}/portal/jobs/${jobId}/photos`
            
            const emailPrice = job.actualPrice || job.estimatedPrice || (planPriceValue ? planPriceValue.toFixed(2) : "0")
            await sendJobCompletedEmail({
              to: customer.email,
              customerName,
              jobTitle: job.title,
              jobDescription: job.description || "",
              completedDate: new Date(),
              durationMinutes: jobDuration,
              actualPrice: emailPrice,
              currency: job.currency || "GBP",
              employeeName,
              companyName: company.name,
              feedbackUrl,
              photosUrl,
              photoCount: 0,
            })
            console.log(`Job completed email sent to customer: ${customer.email}`)
          }
          }

          // Send check-out notification to EMPLOYER/ADMIN
          if (allowEmployeeUpdates) {
            for (const adminUser of adminUsers) {
              if (adminUser.email) {
                try {
                  await sendEmployerCheckOutNotification({
                    employerEmail: adminUser.email,
                    employerName: adminUser.firstName,
                    employeeName,
                    customerName,
                    jobTitle: job.title,
                    jobId: job.id,
                    checkOutTime: new Date(),
                    location,
                    durationMinutes: jobDuration,
                    comment: trimmedComment || null,
                    companyName: company.name,
                    dashboardUrl: `${baseUrl}/job/${job.id}`,
                  })
                  console.log(`Check-out notification sent to employer: ${adminUser.email}`)
                } catch (e) {
                  console.error(`Failed to send check-out notification to ${adminUser.email}:`, e)
                }
              }
            }
          }
        }
      }
    } catch (emailError) {
      // Don't fail the check-in if email fails
      console.error("Failed to send check-in notification email:", emailError)
    }

    return NextResponse.json({
      success: true,
      checkIn,
      message: type === "check_in" ? "Checked in successfully!" : "Checked out successfully!",
    })
  } catch (error) {
    console.error("Error creating check-in:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check in" },
      { status: 500 }
    )
  }
}
