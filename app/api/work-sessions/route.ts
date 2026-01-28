import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/work-sessions - List work sessions (for work hours overview)
// Note: workSessions are filtered via employee.companyId relation
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get("employeeId")
    const jobId = searchParams.get("jobId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Build conditions based on available fields
    const conditions: any[] = []
    
    if (employeeId) conditions.push(eq(schema.workSessions.employeeId, parseInt(employeeId)))
    if (jobId) conditions.push(eq(schema.workSessions.jobId, parseInt(jobId)))
    if (startDate) conditions.push(gte(schema.workSessions.startedAt, new Date(startDate)))
    if (endDate) conditions.push(lte(schema.workSessions.endedAt, new Date(endDate)))

    const sessions = await db.query.workSessions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.workSessions.startedAt)],
      with: {
        employee: true,
        job: true,
      },
    })

    // Filter to only show sessions for the current company's employees
    const filteredSessions = sessions.filter((s: any) => 
      s.employee && !Array.isArray(s.employee) && s.employee.companyId === session.companyId
    )

    return NextResponse.json(filteredSessions)
  } catch (error) {
    console.error("Error fetching work sessions:", error)
    return NextResponse.json({ error: "Failed to fetch work sessions" }, { status: 500 })
  }
}

// POST /api/work-sessions - Create work session (clock in)
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, jobId, startedAt, endedAt, durationMinutes, notes } = body

    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required" }, { status: 400 })
    }

    // Verify employee belongs to the company
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.id, parseInt(employeeId)),
        eq(schema.employees.companyId, session.companyId)
      ),
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const [workSession] = await db
      .insert(schema.workSessions)
      .values({
        employeeId: parseInt(employeeId),
        jobId: jobId ? parseInt(jobId) : null,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
        durationMinutes: durationMinutes || null,
        notes: notes || null,
        createdAt: new Date(),
      })
      .returning()

    return NextResponse.json(workSession, { status: 201 })
  } catch (error) {
    console.error("Error creating work session:", error)
    return NextResponse.json({ error: "Failed to create work session" }, { status: 500 })
  }
}

