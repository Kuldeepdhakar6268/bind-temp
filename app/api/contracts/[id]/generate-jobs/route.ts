import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, gte, lte, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

interface ScheduleDay {
  day: string // "monday", "tuesday", etc.
  startTime: string // "09:00"
  durationMinutes: number
  tasks?: string[]
}

// Helper to get next occurrence of a specific weekday
function getNextWeekday(date: Date, targetDay: number): Date {
  const result = new Date(date)
  const currentDay = result.getDay()
  const daysUntil = (targetDay - currentDay + 7) % 7
  result.setDate(result.getDate() + (daysUntil === 0 ? 0 : daysUntil))
  return result
}

// Helper to convert day name to number (0 = Sunday, 1 = Monday, etc.)
function dayNameToNumber(day: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }
  return days[day.toLowerCase()] ?? 1
}

// POST /api/contracts/[id]/generate-jobs - Generate recurring jobs from contract
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contractId = parseInt(id)
    const body = await request.json()
    const {
      weeksAhead = 4, 
      assignedTo,
      scheduleDays,
      defaultStartTime = "09:00",
      defaultDurationMinutes = 120,
    } = body

    // Fetch the contract
    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(schema.contracts.id, contractId),
        eq(schema.contracts.companyId, session.companyId)
      ),
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    if (contract.status !== "active") {
      return NextResponse.json({ error: "Contract must be active to generate jobs" }, { status: 400 })
    }

    // Fetch customer separately for type safety
    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.id, contract.customerId),
    })

    const assignedToId = assignedTo ? parseInt(assignedTo) : null
    if (assignedToId && !Number.isFinite(assignedToId)) {
      return NextResponse.json({ error: "Invalid assigned employee" }, { status: 400 })
    }
    if (assignedToId) {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.id, assignedToId),
          eq(schema.employees.companyId, session.companyId)
        ),
        columns: { id: true },
      })
      if (!employee) {
        return NextResponse.json({ error: "Assigned employee not found" }, { status: 404 })
      }
    }

    const contractEmployeeIds = Array.isArray(contract.employeeIds)
      ? contract.employeeIds
          .map((id: unknown) => parseInt(String(id)))
          .filter((id: number) => Number.isFinite(id))
      : []
    const assignedEmployeeIds = contractEmployeeIds.length
      ? (
          await db.query.employees.findMany({
            where: and(
              eq(schema.employees.companyId, session.companyId),
              inArray(schema.employees.id, contractEmployeeIds)
            ),
            columns: { id: true },
          })
        ).map((employee) => employee.id)
      : []

    // Get schedule days from request or contract
    const daysToSchedule: ScheduleDay[] = scheduleDays || 
      (contract.scheduleDays as ScheduleDay[] | null) || 
      []

    if (daysToSchedule.length === 0) {
      return NextResponse.json({ 
        error: "No schedule days defined. Please specify which days to schedule jobs." 
      }, { status: 400 })
    }

    // Calculate date range
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)
    
    // If contract has a start date in the future, use that
    const contractStart = new Date(contract.startDate)
    if (contractStart > startDate) {
      startDate.setTime(contractStart.getTime())
    }

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + (weeksAhead * 7))
    
    // If contract has an end date, don't schedule beyond it
    if (contract.endDate) {
      const contractEnd = new Date(contract.endDate)
      if (contractEnd < endDate) {
        endDate.setTime(contractEnd.getTime())
      }
    }

    // Get existing jobs for this contract in the date range to avoid duplicates
    const existingJobs = await db.query.jobs.findMany({
      where: and(
        eq(schema.jobs.companyId, session.companyId),
        eq(schema.jobs.customerId, contract.customerId),
        gte(schema.jobs.scheduledFor, startDate),
        lte(schema.jobs.scheduledFor, endDate)
      ),
    })

    // Create a set of existing scheduled dates for quick lookup
    const existingDates = new Set(
      existingJobs.map(job => {
        if (!job.scheduledFor) return ""
        const d = new Date(job.scheduledFor)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )

    // Build customer location
    const location = customer ? [
      customer.address,
      customer.city,
      customer.postcode
    ].filter(Boolean).join(", ") : ""

    // Generate jobs for each scheduled day in the date range
    const jobPayloads: { values: any; tasks: string[] }[] = []
    const currentDate = new Date(startDate)

    let assignmentIndex = 0
    while (currentDate <= endDate) {
      for (const scheduleDay of daysToSchedule) {
        const targetDayNum = dayNameToNumber(scheduleDay.day || scheduleDay as unknown as string)
        const nextOccurrence = getNextWeekday(new Date(currentDate), targetDayNum)
        
        if (nextOccurrence > endDate) continue
        
        // Check if we already have a job for this date
        const dateKey = `${nextOccurrence.getFullYear()}-${nextOccurrence.getMonth()}-${nextOccurrence.getDate()}`
        if (existingDates.has(dateKey)) continue
        
        // Parse start time
        const startTime = scheduleDay.startTime || defaultStartTime
        const [hours, minutes] = startTime.split(":").map(Number)
        const scheduledFor = new Date(nextOccurrence)
        scheduledFor.setHours(hours, minutes, 0, 0)

        // Calculate end time
        const duration = scheduleDay.durationMinutes || defaultDurationMinutes
        const scheduledEnd = new Date(scheduledFor)
        scheduledEnd.setMinutes(scheduledEnd.getMinutes() + duration)

        // Calculate employee pay if hourly rate is set
        let employeePay: string | undefined
        if (contract.hourlyRate) {
          const hourlyRate = parseFloat(contract.hourlyRate)
          const durationHours = duration / 60
          employeePay = (hourlyRate * durationHours).toFixed(2)
        }

        const assignedEmployeeId = assignedToId
          ? assignedToId
          : assignedEmployeeIds.length > 0
            ? assignedEmployeeIds[assignmentIndex % assignedEmployeeIds.length]
            : null

        if (!assignedToId && assignedEmployeeIds.length > 0) {
          assignmentIndex += 1
        }

        const dayTasks = Array.isArray(scheduleDay.tasks)
          ? scheduleDay.tasks
              .map((task) => (typeof task === "string" ? task.trim() : ""))
              .filter((task) => task.length > 0)
          : []

        jobPayloads.push({
          values: {
          companyId: session.companyId,
          customerId: contract.customerId,
          title: contract.title,
          description: contract.description || `Contract: ${contract.contractNumber}`,
          jobType: null,
          location,
          city: customer?.city || null,
          postcode: customer?.postcode || null,
          assignedTo: assignedEmployeeId,
          scheduledFor,
          scheduledEnd,
          durationMinutes: duration,
          status: "scheduled",
          planId: null,
          contractId: contract.id,
          recurrence: contract.frequency || "weekly",
          estimatedPrice: null, // Contract is billed separately
          employeePay: employeePay || null,
          currency: contract.currency || "GBP",
          },
          tasks: dayTasks,
        })

        // Mark this date as used
        existingDates.add(dateKey)
      }

      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7)
    }

    if (jobPayloads.length === 0) {
      return NextResponse.json({ 
        message: "No new jobs to create. Jobs may already exist for this period.",
        created: 0 
      })
    }

    // Insert all jobs
    const createdJobs = await db
      .insert(schema.jobs)
      .values(jobPayloads.map((payload) => payload.values))
      .returning()

    const jobTasksToCreate = createdJobs.flatMap((job, index) => {
      const tasks = jobPayloads[index]?.tasks ?? []
      return tasks.map((task, taskIndex) => ({
        jobId: job.id,
        title: task,
        order: taskIndex,
      }))
    })

    if (jobTasksToCreate.length > 0) {
      try {
        await db.insert(schema.jobTasks).values(jobTasksToCreate)
      } catch (taskError) {
        console.error("Failed to create job tasks from contract schedule:", taskError)
      }
    }

    // Update contract's lastGeneratedDate
    await db
      .update(schema.contracts)
      .set({ 
        updatedAt: new Date(),
      })
      .where(eq(schema.contracts.id, contractId))

    return NextResponse.json({
      message: `Successfully created ${createdJobs.length} jobs`,
      created: createdJobs.length,
      jobs: createdJobs.map(j => ({
        id: j.id,
        title: j.title,
        scheduledFor: j.scheduledFor,
        status: j.status,
      })),
    })
  } catch (error) {
    console.error("Error generating jobs from contract:", error)
    return NextResponse.json({ error: "Failed to generate jobs" }, { status: 500 })
  }
}
