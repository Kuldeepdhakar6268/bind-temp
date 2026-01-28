import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { and, desc, eq, inArray } from "drizzle-orm"
import { sendShiftSwapRequestEmail } from "@/lib/email"

export async function GET() {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const swaps = await db.query.shiftSwapRequests.findMany({
      where: eq(schema.shiftSwapRequests.companyId, session.companyId),
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
    console.error("Error fetching shift swaps:", error)
    return NextResponse.json({ error: "Failed to fetch shift swaps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

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

    if (!fromJob.assignedTo || !toJob.assignedTo) {
      return NextResponse.json({ error: "Both jobs must be assigned to an employee" }, { status: 400 })
    }

    if (fromJob.assignedTo === toJob.assignedTo) {
      return NextResponse.json({ error: "Jobs must belong to two different employees" }, { status: 400 })
    }

    if (String(fromJob.status).toLowerCase() !== "scheduled" || String(toJob.status).toLowerCase() !== "scheduled") {
      return NextResponse.json({ error: "Both jobs must be scheduled to request a swap" }, { status: 400 })
    }

    const employees = await db.query.employees.findMany({
      where: inArray(schema.employees.id, [fromJob.assignedTo, toJob.assignedTo]),
    })

    const fromEmployee = employees.find((emp) => emp.id === fromJob.assignedTo)
    const toEmployee = employees.find((emp) => emp.id === toJob.assignedTo)

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
        requestedByRole: "company",
        reason: reason || null,
      })
      .returning()

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const formatJobTime = (job: typeof fromJob) => {
      const date = job.scheduledFor ? new Date(job.scheduledFor) : null
      const time = date ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Time TBD"
      const day = date ? date.toLocaleDateString("en-GB") : "Date TBD"
      return `${day} ${time}`
    }

    const requestedByName = company?.name || "Company"

    if (fromEmployee.email) {
      try {
        await sendShiftSwapRequestEmail({
          to: fromEmployee.email,
          employeeName: `${fromEmployee.firstName} ${fromEmployee.lastName}`,
          companyName: company?.name || "Your Company",
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

    if (toEmployee.email) {
      try {
        await sendShiftSwapRequestEmail({
          to: toEmployee.email,
          employeeName: `${toEmployee.firstName} ${toEmployee.lastName}`,
          companyName: company?.name || "Your Company",
          requestedByName,
          fromJobTitle: toJob.title,
          fromJobTime: formatJobTime(toJob),
          toJobTitle: fromJob.title,
          toJobTime: formatJobTime(fromJob),
          reason,
        })
      } catch (emailError) {
        console.error("Failed to send swap request email:", emailError)
      }
    }

    return NextResponse.json(swap, { status: 201 })
  } catch (error) {
    console.error("Error creating shift swap:", error)
    return NextResponse.json({ error: "Failed to create shift swap" }, { status: 500 })
  }
}
