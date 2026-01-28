import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, inArray } from "drizzle-orm"
import { generateSecureToken } from "@/lib/utils"
import { sendJobAssignmentEmail, sendJobUnassignedEmail } from "@/lib/email"

function buildFullAddress(job: {
  location?: string | null
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
}) {
  const normalizeAddressPart = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "")

  const location = (job.location || "").trim()
  const addressLine2 = (job.addressLine2 || "").trim()
  const city = (job.city || "").trim()
  const postcode = (job.postcode || "").trim()

  const parts: string[] = []

  if (location) {
    parts.push(location)
  }

  let normalized = normalizeAddressPart(parts.join(", "))

  if (addressLine2 && !normalized.includes(normalizeAddressPart(addressLine2))) {
    parts.push(addressLine2)
    normalized = normalizeAddressPart(parts.join(", "))
  }

  if (city && !normalized.includes(normalizeAddressPart(city))) {
    parts.push(city)
    normalized = normalizeAddressPart(parts.join(", "))
  }

  if (postcode && !normalized.includes(normalizeAddressPart(postcode))) {
    parts.push(postcode)
  }

  return parts.join(", ")
}

// GET /api/jobs/[id] - Get a specific job
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const job = await db.query.jobs.findFirst({
      where: and(eq(schema.jobs.id, jobId), eq(schema.jobs.companyId, session.companyId)),
      with: {
        customer: true,
        assignee: true,
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const assignments = await db.query.jobAssignments.findMany({
      where: and(eq(schema.jobAssignments.jobId, jobId), eq(schema.jobAssignments.companyId, session.companyId)),
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            payType: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...job,
      assignments: assignments.map((assignment) => ({
        employeeId: assignment.employeeId,
        payAmount: assignment.payAmount,
        status: assignment.status,
        employee: assignment.employee
          ? {
              id: assignment.employee.id,
              name: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
              payType: assignment.employee.payType,
            }
          : null,
      })),
    })
  } catch (error) {
    console.error("Get job error:", error)
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 })
  }
}

// PUT /api/jobs/[id] - Update a job
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Verify job belongs to this company
    const existingJob = await db.query.jobs.findFirst({
      where: and(eq(schema.jobs.id, jobId), eq(schema.jobs.companyId, session.companyId)),
      with: {
        customer: true,
        assignee: true,
      },
    })

    if (!existingJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

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
      recurrence,
      recurrenceEndDate,
      status,
      priority,
      completedAt,
      estimatedPrice,
      actualPrice,
      employeePay,
      currency,
      qualityRating,
      customerFeedback,
      internalNotes,
      planId,
    } = body

    // Validate required fields
    if (!title || !customerId) {
      return NextResponse.json({ error: "Title and customer are required" }, { status: 400 })
    }

    // Verify customer belongs to this company
    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, customerId), eq(schema.customers.companyId, session.companyId)),
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const rawAssignments = Array.isArray(assignedEmployees) ? assignedEmployees : null
    const shouldUpdateAssignments = rawAssignments !== null || assignedTo !== undefined
    let normalizedAssignments: { employeeId: number; payAmount: any }[] = []

    if (shouldUpdateAssignments) {
      if (rawAssignments !== null) {
        normalizedAssignments = rawAssignments
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
      } else if (assignedTo !== undefined) {
        normalizedAssignments = assignedTo
          ? [{ employeeId: parseInt(assignedTo.toString(), 10), payAmount: employeePay ?? null }]
          : []
      }
    }

    let assignmentEmployees: typeof existingJob.assignee[] = []
    let employeeById = new Map<number, any>()
    let normalizedAssignmentsWithPay: { employeeId: number; payAmount: string | null; payType: string }[] = []

    if (shouldUpdateAssignments) {
      const assignmentEmployeeIds = Array.from(
        new Set(normalizedAssignments.map((assignment) => assignment.employeeId).filter((id) => Number.isFinite(id)))
      )

      assignmentEmployees = assignmentEmployeeIds.length
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

      employeeById = new Map(assignmentEmployees.map((employee) => [employee.id, employee]))

      const plan = planId
        ? await db.query.cleaningPlans.findFirst({
            where: eq(schema.cleaningPlans.id, planId),
          })
        : existingJob.planId
          ? await db.query.cleaningPlans.findFirst({
              where: eq(schema.cleaningPlans.id, existingJob.planId),
            })
          : null
      const planPrice = plan?.price ? parseFloat(plan.price) : 0

      try {
        normalizedAssignmentsWithPay = normalizedAssignments.map((assignment) => {
          const employee = employeeById.get(assignment.employeeId)
          const payType = employee?.payType || "hourly"
          const rawPay = assignment.payAmount ?? employeePay ?? null

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
    }

    if (!shouldUpdateAssignments && employeePay !== undefined && employeePay !== null) {
      const plan = planId
        ? await db.query.cleaningPlans.findFirst({
            where: eq(schema.cleaningPlans.id, planId),
          })
        : existingJob.planId
          ? await db.query.cleaningPlans.findFirst({
              where: eq(schema.cleaningPlans.id, existingJob.planId),
            })
          : null
      const planPrice = plan?.price ? parseFloat(plan.price) : 0
      const payValue = parseFloat(employeePay)
      if (!Number.isFinite(payValue) || payValue < 0) {
        return NextResponse.json({ error: "Invalid employee pay amount" }, { status: 400 })
      }
      if (planPrice > 0 && payValue > planPrice) {
        return NextResponse.json({ error: "Employee pay cannot exceed cleaning plan price" }, { status: 400 })
      }
    }

    const existingAssignments = await db.query.jobAssignments.findMany({
      where: and(eq(schema.jobAssignments.jobId, jobId), eq(schema.jobAssignments.companyId, session.companyId)),
    })
    const previousAssignmentIds = existingAssignments.map((assignment) => assignment.employeeId)
    const nextAssignmentIds = shouldUpdateAssignments
      ? normalizedAssignmentsWithPay.map((assignment) => assignment.employeeId)
      : previousAssignmentIds
    const assignmentsChanged =
      shouldUpdateAssignments &&
      (previousAssignmentIds.length !== nextAssignmentIds.length ||
        previousAssignmentIds.some((id) => !nextAssignmentIds.includes(id)))

    const removedAssignmentIds = assignmentsChanged
      ? previousAssignmentIds.filter((id) => !nextAssignmentIds.includes(id))
      : []
    const addedAssignmentIds = assignmentsChanged
      ? nextAssignmentIds.filter((id) => !previousAssignmentIds.includes(id))
      : []

    const previousAssigneeId = existingJob.assignedTo ?? null
    const nextPrimaryAssigneeId = nextAssignmentIds[0] ?? null
    const isCompletedJob = existingJob.status === "completed"
    const nextStatus = isCompletedJob ? "completed" : status || existingJob.status || "scheduled"

    // Preload employees and company for notifications
    const [previousAssignee, newAssignee, company] = await Promise.all([
      previousAssigneeId
        ? db.query.employees.findFirst({
            where: and(
              eq(schema.employees.id, previousAssigneeId),
              eq(schema.employees.companyId, session.companyId),
            ),
          })
        : Promise.resolve(null),
      nextPrimaryAssigneeId
        ? db.query.employees.findFirst({
            where: and(
              eq(schema.employees.id, nextPrimaryAssigneeId),
              eq(schema.employees.companyId, session.companyId),
            ),
          })
        : Promise.resolve(null),
      db.query.companies.findFirst({
        where: eq(schema.companies.id, session.companyId),
      }),
    ])

    const resolvedAssignedTo = shouldUpdateAssignments
      ? nextPrimaryAssigneeId
      : assignedTo !== undefined
        ? assignedTo || null
        : existingJob.assignedTo ?? null

    const resolvedEmployeePay = shouldUpdateAssignments
      ? normalizedAssignmentsWithPay[0]?.payAmount ?? null
      : employeePay !== undefined
        ? employeePay
        : existingJob.employeePay ?? null

    // Update job
    const [updatedJob] = await db
      .update(schema.jobs)
      .set({
        title,
        description: description || null,
        customerId,
        assignedTo: resolvedAssignedTo,
        teamMembers: teamMembers || null,
        location: location || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        accessInstructions: accessInstructions || null,
        parkingInstructions: parkingInstructions || null,
        specialInstructions: specialInstructions || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
        durationMinutes: durationMinutes ?? existingJob.durationMinutes ?? 60,
        recurrence: recurrence || "none",
        recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
        status: nextStatus,
        priority: priority || "normal",
        completedAt: completedAt ? new Date(completedAt) : null,
        estimatedPrice: estimatedPrice || null,
        actualPrice: actualPrice || null,
        employeePay: resolvedEmployeePay,
        currency: currency || "GBP",
        qualityRating: qualityRating || null,
        customerFeedback: customerFeedback || null,
        internalNotes: internalNotes || null,
        planId: planId || null,
        // Reset employee acceptance when assignments change
        ...(assignmentsChanged && !isCompletedJob ? { employeeAccepted: null, employeeAcceptedAt: null } : {}),
        // Generate feedback token when job is marked as completed
        feedbackToken: nextStatus === "completed" && !existingJob.feedbackToken 
          ? generateSecureToken(32) 
          : existingJob.feedbackToken,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, jobId))
      .returning()

    if (shouldUpdateAssignments) {
      if (removedAssignmentIds.length > 0) {
        await db
          .delete(schema.jobAssignments)
          .where(
            and(
              eq(schema.jobAssignments.jobId, jobId),
              inArray(schema.jobAssignments.employeeId, removedAssignmentIds)
            )
          )
      }

      if (addedAssignmentIds.length > 0) {
        const assignmentsToInsert = normalizedAssignmentsWithPay.filter((assignment) =>
          addedAssignmentIds.includes(assignment.employeeId)
        )
        if (assignmentsToInsert.length > 0) {
          await db.insert(schema.jobAssignments).values(
            assignmentsToInsert.map((assignment) => ({
              companyId: session.companyId,
              jobId,
              employeeId: assignment.employeeId,
              payAmount: assignment.payAmount,
              status: "assigned",
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          )
        }
      }

      const assignmentsToUpdate = normalizedAssignmentsWithPay.filter((assignment) =>
        previousAssignmentIds.includes(assignment.employeeId)
      )
      for (const assignment of assignmentsToUpdate) {
        await db
          .update(schema.jobAssignments)
          .set({
            payAmount: assignment.payAmount,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.jobAssignments.jobId, jobId),
              eq(schema.jobAssignments.employeeId, assignment.employeeId)
            )
          )
      }
    }

    if (assignmentsChanged && isCompletedJob) {
      try {
        const previousName = previousAssignee
          ? `${previousAssignee.firstName} ${previousAssignee.lastName}`
          : previousAssigneeId
            ? `Employee #${previousAssigneeId}`
            : "Unassigned"
        const newName = newAssignee
          ? `${newAssignee.firstName} ${newAssignee.lastName}`
          : resolvedAssignedTo
            ? `Employee #${resolvedAssignedTo}`
            : "Unassigned"
        await db.insert(schema.jobEvents).values({
          jobId,
          type: "completed_assignee_changed",
          message: `Completed job reassigned from ${previousName} to ${newName}`,
          meta: JSON.stringify({
            jobId,
            previousAssigneeId,
            newAssigneeId: resolvedAssignedTo ?? null,
            changedBy: session.id,
            changedAt: new Date().toISOString(),
          }),
          actorId: null,
        })
      } catch (eventError) {
        console.error("Failed to log completed assignee change:", eventError)
      }
    }

    // Notify cleaners when assignment changes
    if (assignmentsChanged && company && !isCompletedJob) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
      const scheduledDate = updatedJob.scheduledFor ? new Date(updatedJob.scheduledFor) : null
      const scheduledTime = updatedJob.scheduledFor
        ? new Date(updatedJob.scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : null
      const estimatedDuration = updatedJob.durationMinutes ? `${updatedJob.durationMinutes} minutes` : null
      const fullAddress = buildFullAddress(updatedJob)
      const jobUrl = `${baseUrl}/employee/jobs/${jobId}`

      const customer = existingJob.customer as any
      const removedEmployees = removedAssignmentIds.length
        ? await db.query.employees.findMany({
            where: and(
              eq(schema.employees.companyId, session.companyId),
              inArray(schema.employees.id, removedAssignmentIds)
            ),
          })
        : []

      const addedEmployees = addedAssignmentIds.length
        ? await db.query.employees.findMany({
            where: and(
              eq(schema.employees.companyId, session.companyId),
              inArray(schema.employees.id, addedAssignmentIds)
            ),
          })
        : []

      const newAssigneeNames = addedEmployees.map((employee) => `${employee.firstName} ${employee.lastName}`)
      const newAssigneeLabel =
        newAssigneeNames.length === 0
          ? null
          : newAssigneeNames.length === 1
            ? newAssigneeNames[0]
            : "Multiple employees"

      for (const employee of removedEmployees) {
        if (!employee.email) continue
        try {
          await sendJobUnassignedEmail({
            employeeEmail: employee.email,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            jobTitle: updatedJob.title,
            scheduledDate,
            companyName: company.name,
            newAssigneeName: newAssigneeLabel,
            jobUrl,
          })
        } catch (emailError) {
          console.error("Failed to send unassigned email:", emailError)
        }
      }

      for (const employee of addedEmployees) {
        if (!employee.email) continue
        try {
          await sendJobAssignmentEmail({
            employeeEmail: employee.email,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            jobTitle: updatedJob.title,
            jobDescription: updatedJob.description || "",
            customerName: customer ? `${customer.firstName} ${customer.lastName}` : "Customer",
            customerPhone: customer?.phone || null,
            address: fullAddress,
            scheduledDate: scheduledDate || new Date(),
            scheduledTime,
            estimatedDuration,
            specialInstructions: updatedJob.accessInstructions || null,
            companyName: company.name,
            jobUrl,
          })
        } catch (emailError) {
          console.error("Failed to send assignment email:", emailError)
        }
      }
    }

    return NextResponse.json(updatedJob)
  } catch (error) {
    console.error("Update job error:", error)
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 })
  }
}

// DELETE /api/jobs/[id] - Delete a job
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    const job = await db.query.jobs.findFirst({
      where: and(eq(schema.jobs.id, jobId), eq(schema.jobs.companyId, session.companyId)),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.status === "completed" && session.role !== "admin" && session.role !== "owner") {
      return NextResponse.json(
        { error: "Only admins can delete completed jobs" },
        { status: 403 },
      )
    }

    // Delete job (will cascade to job tasks)
    const [deletedJob] = await db
      .delete(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.companyId, session.companyId)))
      .returning()

    if (!deletedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Job deleted successfully" })
  } catch (error) {
    console.error("Delete job error:", error)
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 })
  }
}

