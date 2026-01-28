import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"
import { sendJobAssignmentEmail } from "@/lib/email"

const parseDurationMinutes = (value?: string | null) => {
  if (!value) return 60
  const normalized = value.toLowerCase()
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/)
  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m/)
  if (hourMatch || minMatch) {
    const hours = hourMatch ? Math.round(parseFloat(hourMatch[1]) * 60) : 0
    const mins = minMatch ? Math.round(parseFloat(minMatch[1])) : 0
    return Math.max(15, hours + mins)
  }
  const numeric = parseInt(normalized, 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 60
}

/**
 * POST /api/booking-requests/[id]/convert
 * Convert a booking request into a job (and optionally create a customer)
 */
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
    const requestId = parseInt(id)

    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    // Get the booking request
    const [bookingRequest] = await db
      .select()
      .from(schema.bookingRequests)
      .where(
        and(
          eq(schema.bookingRequests.id, requestId),
          eq(schema.bookingRequests.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!bookingRequest) {
      return NextResponse.json({ error: "Booking request not found" }, { status: 404 })
    }

    if (bookingRequest.status === "converted") {
      return NextResponse.json(
        { error: "This booking request has already been converted to a job" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      assignedTo,
      scheduledFor,
      scheduledEnd,
      durationMinutes,
      title,
      estimatedPrice,
      employeePay,
      planId,
      createCustomer = true,
      sendNotification = true,
    } = body

    const scheduledStart = scheduledFor
      ? new Date(scheduledFor)
      : (bookingRequest.preferredDate ? new Date(bookingRequest.preferredDate) : null)
    if (scheduledStart && Number.isNaN(scheduledStart.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled start time" }, { status: 400 })
    }
    if (scheduledStart && scheduledStart.getTime() < Date.now()) {
      return NextResponse.json({ error: "Scheduled time cannot be in the past" }, { status: 400 })
    }

    if (!planId) {
      return NextResponse.json({ error: "Cleaning plan is required" }, { status: 400 })
    }

    const plan = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, planId),
    })

    if (!plan) {
      return NextResponse.json({ error: "Cleaning plan not found" }, { status: 404 })
    }

    const numericDuration = typeof durationMinutes === "string" ? parseInt(durationMinutes, 10) : durationMinutes
    const resolvedDurationMinutes =
      Number.isFinite(numericDuration) && (numericDuration as number) > 0
        ? (numericDuration as number)
        : parseDurationMinutes(plan.estimatedDuration)

    if (employeePay === undefined || employeePay === null) {
      return NextResponse.json({ error: "Employee pay is required" }, { status: 400 })
    }
    if (employeePay !== undefined && employeePay !== null) {
      const planPrice = plan.price ? parseFloat(plan.price) : 0
      const payValue = parseFloat(employeePay)
      if (!Number.isFinite(payValue) || payValue < 0) {
        return NextResponse.json({ error: "Invalid employee pay amount" }, { status: 400 })
      }
      if (planPrice > 0 && payValue > planPrice) {
        return NextResponse.json({ error: "Employee pay cannot exceed cleaning plan price" }, { status: 400 })
      }
    }

    // Determine customer ID
    let customerId = bookingRequest.customerId

    // Create customer if doesn't exist
    if (!customerId && createCustomer) {
      const [newCustomer] = await db
        .insert(schema.customers)
        .values({
          companyId: session.companyId,
          firstName: bookingRequest.customerFirstName,
          lastName: bookingRequest.customerLastName,
          email: bookingRequest.customerEmail,
          phone: bookingRequest.customerPhone,
          address: bookingRequest.address,
          addressLine2: bookingRequest.addressLine2,
          city: bookingRequest.city,
          postcode: bookingRequest.postcode,
          accessInstructions: bookingRequest.accessInstructions,
          customerType: bookingRequest.propertyType === "office" ? "commercial" : "residential",
          status: "active",
          source: bookingRequest.source || "booking_request",
        })
        .returning()

      customerId = newCustomer.id

      // Update booking request with new customer ID
      await db
        .update(schema.bookingRequests)
        .set({ customerId: newCustomer.id })
        .where(eq(schema.bookingRequests.id, requestId))
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required. Either create a customer or link to an existing one." },
        { status: 400 }
      )
    }

    // Generate job title based on service type
    const serviceTypeLabels: Record<string, string> = {
      regular: "Regular Cleaning",
      deep_clean: "Deep Cleaning",
      move_in: "Move-In Cleaning",
      move_out: "Move-Out Cleaning",
      one_time: "One-Time Cleaning",
      spring_clean: "Spring Cleaning",
    }
    
    const jobTitle = title || serviceTypeLabels[bookingRequest.serviceType] || "Cleaning Service"

    // Create the job
    const [newJob] = await db
      .insert(schema.jobs)
      .values({
        companyId: session.companyId,
        customerId,
        title: jobTitle,
        description: bookingRequest.specialRequirements || null,
        assignedTo: assignedTo || null,
        planId,
        location: bookingRequest.address,
        addressLine2: bookingRequest.addressLine2,
        city: bookingRequest.city,
        postcode: bookingRequest.postcode,
        accessInstructions: bookingRequest.accessInstructions,
        scheduledFor: scheduledStart,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        durationMinutes: resolvedDurationMinutes,
        recurrence: bookingRequest.frequency !== "one_time" ? bookingRequest.frequency : null,
        status: assignedTo ? "scheduled" : "pending",
        priority: bookingRequest.priority || "normal",
        estimatedPrice: estimatedPrice || bookingRequest.quotedPrice || bookingRequest.estimatedPrice,
        currency: bookingRequest.currency || "GBP",
        internalNotes: `Converted from booking request #${requestId}`,
        employeePay: employeePay !== undefined && employeePay !== null ? employeePay : null,
      })
      .returning()

    // Update booking request status
    await db
      .update(schema.bookingRequests)
      .set({
        status: "converted",
        convertedToJobId: newJob.id,
        convertedAt: new Date(),
        convertedBy: session.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.bookingRequests.id, requestId))

    try {
      const planTasks = await db.query.planTasks.findMany({
        where: eq(schema.planTasks.planId, planId),
        orderBy: (tasks, { asc }) => [asc(tasks.order)],
      })

      if (planTasks.length > 0) {
        await db.insert(schema.jobTasks).values(
          planTasks.map((task) => ({
            jobId: newJob.id,
            title: task.title,
            description: task.description || null,
            order: task.order ?? 0,
          }))
        )
      }
    } catch (taskError) {
      console.error("Failed to create job tasks from plan:", taskError)
    }

    // Create job event
    await db.insert(schema.jobEvents).values({
      jobId: newJob.id,
      type: "job_created",
      message: `Job created from booking request #${requestId}`,
      createdAt: new Date(),
    })

    // Get company info for emails
    const [company] = await db
      .select()
      .from(schema.companies)
      .where(eq(schema.companies.id, session.companyId))
      .limit(1)

    // Calculate scheduled date
    const scheduledDate = scheduledFor ? new Date(scheduledFor) : (bookingRequest.preferredDate ? new Date(bookingRequest.preferredDate) : null)

    // NOTE: Customer confirmation email is NOT sent here!
    // It will only be sent after the assigned employee accepts the job
    // via POST /api/employee/jobs/[id]/accept
    // This ensures both employer AND employee have confirmed before customer is notified
    
    // If no employee is assigned yet, mark for later confirmation
    // If employee is assigned, they will need to accept the job first

    // If assigned, create assignment event and send notification to employee
    if (assignedTo) {
      const employee = await db.query.employees.findFirst({
        where: eq(schema.employees.id, assignedTo),
      })

      if (employee) {
        await db.insert(schema.jobEvents).values({
          jobId: newJob.id,
          type: "job_assigned",
          message: `Job assigned to ${employee.firstName} ${employee.lastName}`,
          createdAt: new Date(),
        })

        // Send email notification to employee asking them to accept the job
        if (sendNotification && employee.email) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
            const fullAddress = [bookingRequest.address, bookingRequest.city, bookingRequest.postcode].filter(Boolean).join(", ")
            
            await sendJobAssignmentEmail({
              employeeEmail: employee.email,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              jobTitle: jobTitle,
              jobDescription: bookingRequest.specialRequirements || "",
              customerName: `${bookingRequest.customerFirstName} ${bookingRequest.customerLastName}`,
              customerPhone: bookingRequest.customerPhone || null,
              address: fullAddress,
              scheduledDate: scheduledDate || new Date(),
              scheduledTime: scheduledDate ? scheduledDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
              estimatedDuration: resolvedDurationMinutes ? `${resolvedDurationMinutes} minutes` : null,
              specialInstructions: bookingRequest.accessInstructions || null,
              companyName: company?.name || "Our cleaning team",
              jobUrl: `${baseUrl}/employee/jobs/${newJob.id}`,
            })
          } catch (emailError) {
            console.error("Failed to send job assignment email to employee:", emailError)
          }
        }
      }
    }

    // Fetch the complete job with customer info
    const [completeJob] = await db
      .select({
        job: schema.jobs,
        customer: {
          id: schema.customers.id,
          firstName: schema.customers.firstName,
          lastName: schema.customers.lastName,
          email: schema.customers.email,
        },
      })
      .from(schema.jobs)
      .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .where(eq(schema.jobs.id, newJob.id))
      .limit(1)

    return NextResponse.json({
      success: true,
      job: {
        ...completeJob.job,
        customer: completeJob.customer
          ? {
              id: completeJob.customer.id,
              name: `${completeJob.customer.firstName} ${completeJob.customer.lastName}`,
              email: completeJob.customer.email,
            }
          : null,
      },
      customerCreated: !bookingRequest.customerId,
    })
  } catch (error) {
    console.error("Error converting booking request:", error)
    return NextResponse.json(
      { error: "Failed to convert booking request" },
      { status: 500 }
    )
  }
}
