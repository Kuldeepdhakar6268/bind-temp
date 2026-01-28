import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, gte, lte } from "drizzle-orm"

type PublicHoliday = { date: string; title: string }
type TimeOffByDate = Record<string, { employees: { id: number; name: string; type: string }[] }>

const UK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json"
const HOLIDAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

let cachedHolidays: { fetchedAt: number; items: PublicHoliday[] } | null = null

const toDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().split("T")[0]
}

const getUkPublicHolidays = async (): Promise<PublicHoliday[]> => {
  if (cachedHolidays && Date.now() - cachedHolidays.fetchedAt < HOLIDAY_CACHE_TTL_MS) {
    return cachedHolidays.items
  }

  try {
    const response = await fetch(UK_HOLIDAYS_URL, { next: { revalidate: 86400 } })
    if (!response.ok) {
      return []
    }
    const data = await response.json()
    const events = data?.["england-and-wales"]?.events || []
    const items: PublicHoliday[] = events.map((event: { date: string; title: string }) => ({
      date: event.date,
      title: event.title,
    }))
    cachedHolidays = { fetchedAt: Date.now(), items }
    return items
  } catch (error) {
    console.warn("Failed to fetch UK public holidays:", error)
    return []
  }
}

// GET /api/jobs/calendar - Get jobs in calendar format
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get("start")
    const endDate = searchParams.get("end")
    const employeeId = searchParams.get("employeeId")
    const view = searchParams.get("view") || "month" // day, week, month

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start and end dates are required" },
        { status: 400 }
      )
    }

    const rangeStart = new Date(startDate)
    const rangeEnd = new Date(endDate)

    const conditions = [
      eq(schema.jobs.companyId, session.companyId),
      gte(schema.jobs.scheduledFor, rangeStart),
      lte(schema.jobs.scheduledFor, rangeEnd),
    ]

    if (employeeId) {
      conditions.push(eq(schema.jobs.assignedTo, parseInt(employeeId)))
    }

    const jobs = await db.query.jobs.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        assignee: true,
      },
      orderBy: (jobs, { asc }) => [asc(jobs.scheduledFor)],
    })

    // Get employees for the schedule view
    const employees = await db.query.employees.findMany({
      where: eq(schema.employees.companyId, session.companyId),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        color: true,
      },
    })

    // Transform jobs into calendar events
    const events = jobs.map((job) => {
      const start = job.scheduledFor ? new Date(job.scheduledFor) : new Date()
      const end = job.scheduledEnd
        ? new Date(job.scheduledEnd)
        : new Date(start.getTime() + (job.durationMinutes || 60) * 60000)

      return {
        id: job.id,
        title: job.title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        status: job.status,
        priority: job.priority,
        color: getStatusColor(job.status),
        resourceId: job.assignedTo, // For resource view
        extendedProps: {
          customer: job.customer
            ? {
                id: job.customer.id,
                name: `${job.customer.firstName} ${job.customer.lastName}`,
                email: job.customer.email,
              }
            : null,
          assignee: job.assignee
            ? {
                id: job.assignee.id,
                name: `${job.assignee.firstName} ${job.assignee.lastName}`,
              }
            : null,
          location: job.location,
          city: job.city,
          postcode: job.postcode,
          estimatedPrice: job.estimatedPrice,
          currency: job.currency,
          durationMinutes: job.durationMinutes,
        },
      }
    })

    const timeOffRequests = await db.query.timeOffRequests.findMany({
      where: and(
        eq(schema.timeOffRequests.companyId, session.companyId),
        eq(schema.timeOffRequests.status, "approved"),
        lte(schema.timeOffRequests.startDate, rangeEnd),
        gte(schema.timeOffRequests.endDate, rangeStart)
      ),
      with: {
        employee: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    const timeOffByDate: TimeOffByDate = {}
    const rangeStartMs = rangeStart.getTime()
    const rangeEndMs = rangeEnd.getTime()
    timeOffRequests.forEach((request) => {
      const employee = request.employee
      if (!employee) return
      const startMs = new Date(request.startDate).getTime()
      const endMs = new Date(request.endDate).getTime()
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) return

      const clampedStart = new Date(Math.max(startMs, rangeStartMs))
      const clampedEnd = new Date(Math.min(endMs, rangeEndMs))
      clampedStart.setHours(0, 0, 0, 0)
      clampedEnd.setHours(0, 0, 0, 0)

      for (
        let cursor = new Date(clampedStart);
        cursor.getTime() <= clampedEnd.getTime();
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const key = toDateKey(cursor)
        if (!key) continue
        if (!timeOffByDate[key]) {
          timeOffByDate[key] = { employees: [] }
        }
        const list = timeOffByDate[key].employees
        if (!list.some((existing) => existing.id === employee.id)) {
          list.push({
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            type: request.type,
          })
        }
      }
    })

    const publicHolidays = await getUkPublicHolidays()
    const rangeStartKey = toDateKey(rangeStart)
    const rangeEndKey = toDateKey(rangeEnd)
    const publicHolidaysByDate: Record<string, { title: string }[]> = {}

    publicHolidays
      .filter((holiday) => holiday.date >= rangeStartKey && holiday.date <= rangeEndKey)
      .forEach((holiday) => {
        if (!publicHolidaysByDate[holiday.date]) {
          publicHolidaysByDate[holiday.date] = []
        }
        publicHolidaysByDate[holiday.date].push({ title: holiday.title })
      })

    // Group by day for the day view
    const groupedByDay: Record<string, typeof events> = {}
    events.forEach((event) => {
      const dayKey = event.start.split("T")[0]
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = []
      }
      groupedByDay[dayKey].push(event)
    })

    // Group by employee for resource view
    const groupedByEmployee: Record<string, typeof events> = {}
    events.forEach((event) => {
      const employeeKey = event.resourceId?.toString() || "unassigned"
      if (!groupedByEmployee[employeeKey]) {
        groupedByEmployee[employeeKey] = []
      }
      groupedByEmployee[employeeKey].push(event)
    })

    // Calculate daily stats
    const dailyStats = Object.entries(groupedByDay).map(([date, dayEvents]) => ({
      date,
      total: dayEvents.length,
      scheduled: dayEvents.filter((e) => e.status === "scheduled").length,
      inProgress: dayEvents.filter((e) => e.status === "in-progress").length,
      completed: dayEvents.filter((e) => e.status === "completed").length,
      cancelled: dayEvents.filter((e) => e.status === "cancelled").length,
      totalRevenue: dayEvents.reduce(
        (sum, e) =>
          sum + (e.extendedProps.estimatedPrice ? parseFloat(e.extendedProps.estimatedPrice) : 0),
        0
      ),
    }))

    // Get resources (employees) for resource view
    const resources = employees.map((emp) => ({
      id: emp.id,
      title: `${emp.firstName} ${emp.lastName}`,
      role: emp.role,
      color: emp.color || getEmployeeColor(emp.id),
    }))

    return NextResponse.json({
      events,
      resources,
      groupedByDay,
      groupedByEmployee,
      dailyStats,
      timeOffByDate,
      publicHolidaysByDate,
      meta: {
        totalJobs: jobs.length,
        dateRange: { start: startDate, end: endDate },
        view,
      },
    })
  } catch (error) {
    console.error("Get calendar error:", error)
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 })
  }
}

// POST /api/jobs/calendar - Bulk schedule/reschedule jobs
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()

    const { action, jobIds, changes } = body

    if (!action || !jobIds || !Array.isArray(jobIds)) {
      return NextResponse.json(
        { error: "Action and job IDs are required" },
        { status: 400 }
      )
    }

    const results: { success: number[]; failed: number[] } = {
      success: [],
      failed: [],
    }

    for (const jobId of jobIds) {
      try {
        // Verify job belongs to company
        const job = await db.query.jobs.findFirst({
          where: and(
            eq(schema.jobs.id, jobId),
            eq(schema.jobs.companyId, session.companyId)
          ),
        })

        if (!job) {
          results.failed.push(jobId)
          continue
        }

        switch (action) {
          case "reschedule":
            if (!changes.scheduledFor) {
              results.failed.push(jobId)
              continue
            }
            await db
              .update(schema.jobs)
              .set({
                scheduledFor: new Date(changes.scheduledFor),
                scheduledEnd: changes.scheduledEnd ? new Date(changes.scheduledEnd) : null,
                updatedAt: new Date(),
              })
              .where(eq(schema.jobs.id, jobId))
            results.success.push(jobId)
            break

          case "assign":
            if (!changes.assignedTo) {
              results.failed.push(jobId)
              continue
            }
            await db
              .update(schema.jobs)
              .set({
                assignedTo: changes.assignedTo,
                updatedAt: new Date(),
              })
              .where(eq(schema.jobs.id, jobId))
            results.success.push(jobId)
            break

          case "updateStatus":
            if (!changes.status) {
              results.failed.push(jobId)
              continue
            }
            await db
              .update(schema.jobs)
              .set({
                status: changes.status,
                updatedAt: new Date(),
              })
              .where(eq(schema.jobs.id, jobId))
            results.success.push(jobId)
            break

          default:
            results.failed.push(jobId)
        }
      } catch (err) {
        console.error(`Failed to process job ${jobId}:`, err)
        results.failed.push(jobId)
      }
    }

    // Log the bulk action
    await db.insert(schema.eventLog).values({
      companyId: session.companyId,
      eventType: `bulk_${action}`,
      entityType: "job",
      entityId: "multiple",
      description: `Bulk ${action}: ${results.success.length} succeeded, ${results.failed.length} failed`,
      metadata: JSON.stringify({
        action,
        jobIds,
        changes,
        results,
        performedBy: session.id,
      }),
    })

    return NextResponse.json({
      success: true,
      results,
      message: `${results.success.length} jobs updated, ${results.failed.length} failed`,
    })
  } catch (error) {
    console.error("Bulk calendar action error:", error)
    return NextResponse.json({ error: "Failed to process bulk action" }, { status: 500 })
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    scheduled: "#3B82F6", // blue
    "in-progress": "#F59E0B", // amber
    completed: "#10B981", // green
    cancelled: "#EF4444", // red
    pending: "#6B7280", // gray
  }
  return colors[status] || "#6B7280"
}

function getEmployeeColor(id: number): string {
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
  ]
  return colors[id % colors.length]
}

