import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getEmployeeSession } from "@/lib/auth"
import { and, desc, eq, inArray, or } from "drizzle-orm"
import { sendShiftSwapRequestEmail } from "@/lib/email"

export async function GET() {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const swaps = await db.query.shiftSwapRequests.findMany({
      where: and(
        eq(schema.shiftSwapRequests.companyId, session.companyId),
        or(
          eq(schema.shiftSwapRequests.fromEmployeeId, session.id),
          eq(schema.shiftSwapRequests.toEmployeeId, session.id)
        )
      ),
      with: {
        fromEmployee: true,
        toEmployee: true,
        requestedBy: true,
        fromJob: { with: { customer: true } },
        toJob: { with: { customer: true } },
      },
      orderBy: [desc(schema.shiftSwapRequests.createdAt)],
    })

    return NextResponse.json(swaps)
  } catch (error) {
    console.error("Error fetching employee shift swaps:", error)
    return NextResponse.json({ error: "Failed to fetch shift swaps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const body = await request.json()
    const fromJobId = parseInt(body.fromJobId)
    const toJobId = parseInt(body.toJobId)
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""

    if (!fromJobId || !toJobId || fromJobId === toJobId) {
      return NextResponse.json({ error: "Two different jobs are required" }, { status: 400 })
    }

    const jobs = await db.query.jobs.findMany({
      where: and(
        eq(schema.jobs.companyId, session.companyId),
        inArray(schema.jobs.id, [fromJobId, toJobId])
      ),
      with: { customer: true },
    })

    if (jobs.length !== 2) {
      return NextResponse.json({ error: "Jobs not found" }, { status: 404 })
    }

    const fromJob = jobs.find((job) => job.id === fromJobId)!
    const toJob = jobs.find((job) => job.id === toJobId)!

    const assignments = await db.query.jobAssignments.findMany({
      where: and(
        eq(schema.jobAssignments.companyId, session.companyId),
        inArray(schema.jobAssignments.jobId, [fromJobId, toJobId])
      ),
    })

    const fromAssignments = assignments.filter((assignment) => assignment.jobId === fromJobId)
    const toAssignments = assignments.filter((assignment) => assignment.jobId === toJobId)

    if (fromAssignments.length > 1 || toAssignments.length > 1) {
      return NextResponse.json(
        { error: "Shift swaps are only available for jobs with a single assigned employee." },
        { status: 400 }
      )
    }

    const fromAssignedTo = fromAssignments[0]?.employeeId ?? fromJob.assignedTo ?? null
    const toAssignedTo = toAssignments[0]?.employeeId ?? toJob.assignedTo ?? null

    if (!fromAssignedTo || !toAssignedTo) {
      return NextResponse.json({ error: "Both jobs must be assigned to an employee" }, { status: 400 })
    }

    if (fromAssignedTo !== session.id) {
      return NextResponse.json({ error: "You can only request swaps for your own job" }, { status: 403 })
    }

    if (fromAssignedTo === toAssignedTo) {
      return NextResponse.json({ error: "Jobs must belong to two different employees" }, { status: 400 })
    }

    if (String(fromJob.status).toLowerCase() !== "scheduled" || String(toJob.status).toLowerCase() !== "scheduled") {
      return NextResponse.json({ error: "Both jobs must be scheduled to request a swap" }, { status: 400 })
    }

    const employees = await db.query.employees.findMany({
      where: inArray(schema.employees.id, [fromAssignedTo, toAssignedTo]),
    })

    const fromEmployee = employees.find((emp) => emp.id === fromAssignedTo)
    const toEmployee = employees.find((emp) => emp.id === toAssignedTo)

    if (!fromEmployee || !toEmployee) {
      return NextResponse.json({ error: "Employees not found" }, { status: 404 })
    }

    const [swap] = await db
      .insert(schema.shiftSwapRequests)
      .values({
        companyId: session.companyId,
        fromEmployeeId: fromEmployee.id,
        toEmployeeId: toEmployee.id,
        fromJobId: fromJob.id,
        toJobId: toJob.id,
        requestedByEmployeeId: session.id,
        requestedByRole: "employee",
        reason: reason || null,
      })
      .returning()

    const formatJobTime = (job: typeof fromJob) => {
      const date = job.scheduledFor ? new Date(job.scheduledFor) : null
      const time = date ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Time TBD"
      const day = date ? date.toLocaleDateString("en-GB") : "Date TBD"
      return `${day} ${time}`
    }

    const requestedByName = `${fromEmployee.firstName} ${fromEmployee.lastName}`

    if (toEmployee.email) {
      try {
        await sendShiftSwapRequestEmail({
          to: toEmployee.email,
          employeeName: `${toEmployee.firstName} ${toEmployee.lastName}`,
          companyName: session.companyName || "Your Company",
          requestedByName,
          fromJobTitle: fromJob.title,
          fromJobTime: formatJobTime(fromJob),
          toJobTitle: toJob.title,
          toJobTime: formatJobTime(toJob),
          reason,
        })
      } catch (emailError) {
        console.error("Failed to send swap request email:", emailError)
      }
    }

    if (fromEmployee.email) {
      try {
        await sendShiftSwapRequestEmail({
          to: fromEmployee.email,
          employeeName: `${fromEmployee.firstName} ${fromEmployee.lastName}`,
          companyName: session.companyName || "Your Company",
          requestedByName,
          fromJobTitle: fromJob.title,
          fromJobTime: formatJobTime(fromJob),
          toJobTitle: toJob.title,
          toJobTime: formatJobTime(toJob),
          reason,
        })
      } catch (emailError) {
        console.error("Failed to send swap request email:", emailError)
      }
    }

    return NextResponse.json(swap, { status: 201 })
  } catch (error) {
    console.error("Error creating employee shift swap:", error)
    return NextResponse.json({ error: "Failed to create shift swap" }, { status: 500 })
  }
}
