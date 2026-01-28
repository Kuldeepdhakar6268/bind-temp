import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, or, ilike, desc, gte, lte, sql, inArray } from "drizzle-orm"
import { startOfDay, endOfDay } from "date-fns"
import { sendJobAssignmentEmail, sendJobCompletedEmail, sendJobCompletedToCompanyEmail } from "@/lib/email"
import { isCompanyNotificationEnabled } from "@/lib/notification-settings"
import { generateInvoiceFromJob } from "@/lib/invoice-utils"
import { generateInvoicePdfBuffer } from "@/lib/invoices-pdf"

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

// GET /api/jobs - Get all jobs for the company
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")
    const assignedTo = searchParams.get("assignedTo")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const filter = searchParams.get("filter") // today, upcoming, etc.
    const limit = searchParams.get("limit")
    const sort = searchParams.get("sort") // updatedAt, scheduledFor

    const conditions = [eq(schema.jobs.companyId, session.companyId)]

    if (search) {
      conditions.push(
        or(
          ilike(schema.jobs.title, `%${search}%`),
          ilike(schema.jobs.description, `%${search}%`),
          ilike(schema.jobs.location, `%${search}%`),
        )!,
      )
    }

    if (status) {
      conditions.push(eq(schema.jobs.status, status))
    }

    if (customerId) {
      conditions.push(eq(schema.jobs.customerId, parseInt(customerId)))
    }

    if (assignedTo) {
      conditions.push(eq(schema.jobs.assignedTo, parseInt(assignedTo)))
    }

    // Handle filter parameter
    if (filter === "today") {
      const today = new Date()
      conditions.push(gte(schema.jobs.scheduledFor, startOfDay(today)))
      conditions.push(lte(schema.jobs.scheduledFor, endOfDay(today)))
    } else if (filter === "upcoming") {
      conditions.push(gte(schema.jobs.scheduledFor, new Date()))
      conditions.push(sql`${schema.jobs.status} IN ('scheduled', 'in-progress')`)
    } else {
      if (startDate) {
        conditions.push(gte(schema.jobs.scheduledFor, new Date(startDate)))
      }

      if (endDate) {
        conditions.push(lte(schema.jobs.scheduledFor, new Date(endDate)))
      }
    }

    // Determine sort order
    const orderBy = sort === "updatedAt" 
      ? [desc(schema.jobs.updatedAt)]
      : [desc(schema.jobs.scheduledFor)]

    const jobs = await db.query.jobs.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        assignee: true,
        assignments: {
          columns: {
            employeeId: true,
          },
        },
      },
      orderBy,
      limit: limit ? parseInt(limit) : undefined,
    })

    return NextResponse.json(jobs)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Get jobs error:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}

// POST /api/jobs - Create a new job
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const {
      title,
      description,
      customerId,
      assignedTo,
      assignedEmployees,
      teamMembers,
      location,
      addressLine2,
      city,
      postcode,
      accessInstructions,
      parkingInstructions,
      specialInstructions,
      scheduledFor,
      scheduledEnd,
      durationMinutes,
      allowPast,
      backCreateComplete,
      recurrence,
      recurrenceEndDate,
      priority,
      estimatedPrice,
      currency,
      internalNotes,
      planId,
      employeePay,
      tasks,
    } = body

    const scheduledStart = scheduledFor ? new Date(scheduledFor) : null
    if (scheduledStart && Number.isNaN(scheduledStart.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled start time" }, { status: 400 })
    }
    if (!allowPast && scheduledStart && scheduledStart.getTime() < Date.now()) {
      return NextResponse.json({ error: "Scheduled time cannot be in the past" }, { status: 400 })
    }

    const rawAssignments = Array.isArray(assignedEmployees) ? assignedEmployees : []
    const normalizedAssignments = rawAssignments
      .map((entry: any) => {
        if (entry === null || entry === undefined) return null
        if (typeof entry === "number" || typeof entry === "string") {
          const employeeId = parseInt(entry.toString(), 10)
          return Number.isFinite(employeeId) ? { employeeId, payAmount: null } : null
        }
        const employeeId = parseInt(entry.employeeId?.toString?.() ?? entry.employeeId, 10)
        if (!Number.isFinite(employeeId)) return null
        return {
          employeeId,
          payAmount: entry.payAmount ?? null,
        }
      })
      .filter(Boolean) as { employeeId: number; payAmount: any }[]

    const fallbackAssignments = assignedTo
      ? [{ employeeId: parseInt(assignedTo.toString(), 10), payAmount: employeePay ?? null }]
      : []

    const assignments = normalizedAssignments.length > 0 ? normalizedAssignments : fallbackAssignments

    // Validate required fields
    if (!title || !customerId || !location || assignments.length === 0 || !planId) {
      return NextResponse.json(
        { error: "Title, customer, plan, location, and assigned staff are required" },
        { status: 400 }
      )
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

    const scheduledEndTime =
      scheduledEnd && scheduledStart
        ? new Date(scheduledEnd)
        : scheduledStart
          ? new Date(scheduledStart.getTime() + resolvedDurationMinutes * 60000)
          : null
    const completedAt =
      backCreateComplete && scheduledStart
        ? scheduledEndTime || scheduledStart
        : backCreateComplete
          ? new Date()
          : null

    // Verify customer belongs to this company
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.companyId, session.companyId)),
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const assignmentEmployeeIds = Array.from(
      new Set(assignments.map((assignment) => assignment.employeeId).filter((id) => Number.isFinite(id)))
    )

    const assignmentEmployees = assignmentEmployeeIds.length
      ? await db.query.employees.findMany({
          where: and(
            eq(schema.employees.companyId, session.companyId),
            inArray(schema.employees.id, assignmentEmployeeIds)
          ),
        })
      : []

    if (assignmentEmployees.length !== assignmentEmployeeIds.length) {
      return NextResponse.json({ error: "One or more assigned employees were not found" }, { status: 404 })
    }

    const employeeById = new Map(assignmentEmployees.map((employee) => [employee.id, employee]))
    const planPrice = plan.price ? parseFloat(plan.price) : 0
    const fallbackPay = employeePay ?? null

    let normalizedAssignmentsWithPay: { employeeId: number; payAmount: string | null; payType: string }[] = []
    try {
      normalizedAssignmentsWithPay = assignments.map((assignment) => {
        const employee = employeeById.get(assignment.employeeId)
        const payType = employee?.payType || "hourly"
        const rawPay = assignment.payAmount ?? fallbackPay

        if (payType === "per_job" && (rawPay === null || rawPay === undefined || rawPay === "")) {
          throw new Error(
            `Pay per job is required for ${employee?.firstName ?? "employee"} ${employee?.lastName ?? ""}`.trim()
          )
        }

        let normalizedPayAmount: string | null = null
        if (rawPay !== null && rawPay !== undefined && rawPay !== "") {
          const payValue = parseFloat(rawPay)
          if (!Number.isFinite(payValue) || payValue < 0) {
            throw new Error("Invalid employee pay amount")
          }
          if (planPrice > 0 && payValue > planPrice) {
            throw new Error("Employee pay cannot exceed cleaning plan price")
          }
          normalizedPayAmount = payValue.toFixed(2)
        }

        return {
          employeeId: assignment.employeeId,
          payAmount: normalizedPayAmount,
          payType,
        }
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid employee pay" },
        { status: 400 }
      )
    }

    const primaryAssignment = normalizedAssignmentsWithPay[0]
    const primaryEmployeePay = primaryAssignment?.payAmount ?? (employeePay ?? null)

    const resolvedActualPrice = backCreateComplete
      ? (estimatedPrice || (plan?.price ? plan.price : null))
      : null

    // Create job
    const [newJob] = await db
      .insert(schema.jobs)
      .values({
        companyId: session.companyId,
        title,
        description: description || null,
        customerId,
        assignedTo: primaryAssignment?.employeeId || null,
        teamMembers: teamMembers || null,
        location: location || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        accessInstructions: accessInstructions || null,
        parkingInstructions: parkingInstructions || null,
        specialInstructions: specialInstructions || null,
        scheduledFor: scheduledStart,
        scheduledEnd: scheduledEndTime,
        durationMinutes: resolvedDurationMinutes,
        recurrence: recurrence || "none",
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        status: backCreateComplete ? "completed" : "scheduled",
        priority: priority || "normal",
        estimatedPrice: estimatedPrice || null,
        actualPrice: resolvedActualPrice,
        currency: currency || "GBP",
        internalNotes: internalNotes || null,
        planId: planId || null,
        employeePay: primaryEmployeePay !== undefined && primaryEmployeePay !== null ? primaryEmployeePay : null,
        completedAt,
      })
      .returning()

    if (normalizedAssignmentsWithPay.length > 0) {
      await db.insert(schema.jobAssignments).values(
        normalizedAssignmentsWithPay.map((assignment) => ({
          companyId: session.companyId,
          jobId: newJob.id,
          employeeId: assignment.employeeId,
          payAmount: assignment.payAmount,
          status: "assigned",
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
    }

    const customTasks = Array.isArray(tasks) ? tasks : []
    if (customTasks.length > 0) {
      const sanitizedTasks = customTasks
        .map((task: any, index: number) => ({
          title: typeof task?.title === "string" ? task.title.trim() : "",
          description: typeof task?.description === "string" ? task.description.trim() : null,
          order: Number.isFinite(task?.order) ? Number(task.order) : index,
        }))
        .filter((task: any) => task.title.length > 0)

      if (sanitizedTasks.length > 0) {
        try {
          await db.insert(schema.jobTasks).values(
            sanitizedTasks.map((task: any) => ({
              jobId: newJob.id,
              title: task.title,
              description: task.description,
              order: task.order ?? 0,
            }))
          )
        } catch (taskError) {
          console.error("Failed to create custom job tasks:", taskError)
        }
      }
    } else if (planId) {
      try {
        const planTasks = await db.query.planTasks.findMany({
          where: eq(schema.planTasks.planId, planId),
          orderBy: (tasks, { asc: ascTask }) => [ascTask(tasks.order)],
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
    }

    let generatedInvoice: { id: number; invoiceNumber: string; total: string } | null = null

    if (backCreateComplete) {
      try {
        generatedInvoice = await generateInvoiceFromJob({
          companyId: session.companyId,
          jobId: newJob.id,
        })

        // Mark the invoice as sent so it is eligible for reminders and reporting.
        if (generatedInvoice) {
          await db
            .update(schema.invoices)
            .set({
              status: "sent",
              amountDue: generatedInvoice.total,
              updatedAt: new Date(),
            })
            .where(eq(schema.invoices.id, generatedInvoice.id))
        }
      } catch (invoiceError) {
        console.error("Failed to generate invoice for back-created job:", invoiceError)
      }
    }

    if (normalizedAssignmentsWithPay.length > 0) {
      try {
        const company = await db.query.companies.findFirst({
          where: eq(schema.companies.id, session.companyId),
        })

        if (company) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
          const normalizeAddressPart = (value: string) =>
            value.toLowerCase().replace(/[^a-z0-9]/g, "")
          const addressParts: string[] = []
          if (location) {
            addressParts.push(location)
          }
          const normalizedBase = normalizeAddressPart(addressParts.join(", "))
          if (city && !normalizedBase.includes(normalizeAddressPart(city))) {
            addressParts.push(city)
          }
          const normalizedWithCity = normalizeAddressPart(addressParts.join(", "))
          if (postcode && !normalizedWithCity.includes(normalizeAddressPart(postcode))) {
            addressParts.push(postcode)
          }
          const fullAddress = addressParts.join(", ")

          for (const assignment of normalizedAssignmentsWithPay) {
            const employee = employeeById.get(assignment.employeeId)
            if (!employee?.email) continue
            await sendJobAssignmentEmail({
              employeeEmail: employee.email,
              employeeName: `${employee.firstName} ${employee.lastName}`,
              jobTitle: title,
              jobDescription: description || "",
              customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
              customerPhone: customer?.phone || null,
              address: fullAddress,
              scheduledDate: scheduledFor ? new Date(scheduledFor) : new Date(),
              scheduledTime: scheduledFor ? new Date(scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
              estimatedDuration: resolvedDurationMinutes ? `${resolvedDurationMinutes} minutes` : null,
              specialInstructions: accessInstructions || null,
              companyName: company.name,
              jobUrl: `${baseUrl}/employee/jobs/${newJob.id}`,
            })
          }

          if (backCreateComplete && customer) {
            try {
              const employeeNames = normalizedAssignmentsWithPay
                .map((assignment) => {
                  const employee = employeeById.get(assignment.employeeId)
                  return employee ? `${employee.firstName} ${employee.lastName}` : null
                })
                .filter(Boolean) as string[]
              const employeeName = employeeNames.length === 1 ? employeeNames[0] : "Cleaning team"
              const jobCompletedAt = completedAt || new Date()
              const emailPrice = estimatedPrice || (plan?.price ? plan.price : "0")
              let invoiceNumber: string | undefined
              let pdfBuffer: Buffer | undefined

              if (generatedInvoice) {
                invoiceNumber = generatedInvoice.invoiceNumber
                try {
                  pdfBuffer = await generateInvoicePdfBuffer(generatedInvoice.id, session.companyId)
                } catch (pdfError) {
                  console.error("Failed to generate invoice PDF for back-created job:", pdfError)
                }
              }

              // Only include "Pay Now" when we can attach the invoice.
              const paymentUrl = pdfBuffer ? `${baseUrl}/portal/dashboard` : undefined

              if (customer.email) {
                await sendJobCompletedEmail({
                  to: customer.email,
                  customerName: `${customer.firstName} ${customer.lastName}`,
                  jobTitle: title,
                  jobDescription: description || "",
                  completedDate: jobCompletedAt,
                  durationMinutes: resolvedDurationMinutes,
                  actualPrice: emailPrice || "0",
                  currency: currency || "GBP",
                  employeeName,
                  companyName: company.name,
                  feedbackUrl: `${baseUrl}/portal/dashboard`,
                  paymentUrl,
                  invoiceNumber: invoiceNumber || null,
                  pdfBuffer,
                })
              }

              if (company.email && isCompanyNotificationEnabled(company.notificationSettings, "jobUpdates")) {
                await sendJobCompletedToCompanyEmail({
                  companyEmail: company.email,
                  companyName: company.name,
                  jobId: newJob.id,
                  jobTitle: title,
                  customerName: `${customer.firstName} ${customer.lastName}`,
                  customerEmail: customer.email || "",
                  employeeName,
                  completedDate: jobCompletedAt,
                  durationMinutes: resolvedDurationMinutes,
                  actualPrice: emailPrice || "0",
                  currency: currency || "GBP",
                  location: fullAddress,
                  dashboardUrl: baseUrl,
                })
              }
            } catch (emailError) {
              console.error("Failed to send back-created completion emails:", emailError)
            }
          }
        }
      } catch (emailError) {
        console.error("Failed to send job assignment email:", emailError)
      }
    }

    return NextResponse.json(newJob, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Create job error:", error)
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 })
  }
}
