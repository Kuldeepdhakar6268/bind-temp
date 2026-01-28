import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, and, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/shifts - List all shifts for the company
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    let conditions = [eq(schema.shifts.companyId, session.companyId)]

    if (employeeId) {
      conditions.push(eq(schema.shifts.employeeId, parseInt(employeeId)))
    }
    if (startDate) {
      conditions.push(gte(schema.shifts.startTime, new Date(startDate)))
    }
    if (endDate) {
      conditions.push(lte(schema.shifts.endTime, new Date(endDate)))
    }

    const shifts = await db.query.shifts.findMany({
      where: and(...conditions),
      with: {
        employee: true,
      },
      orderBy: [desc(schema.shifts.startTime)],
    })

    return NextResponse.json(shifts)
  } catch (error) {
    console.error("Error fetching shifts:", error)
    return NextResponse.json({ error: "Failed to fetch shifts" }, { status: 500 })
  }
}

// POST /api/shifts - Create a new shift
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
    const {
      employeeId,
      title,
      shiftType,
      startTime,
      endTime,
      breakMinutes,
      notes,
    } = body

    if (!employeeId || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Employee, start time, and end time are required" },
        { status: 400 }
      )
    }

    // Validate employee belongs to the company
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.id, parseInt(employeeId)),
        eq(schema.employees.companyId, session.companyId)
      ),
    })

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found or does not belong to this company" },
        { status: 400 }
      )
    }

    const [shift] = await db
      .insert(schema.shifts)
      .values({
        companyId: session.companyId,
        employeeId: parseInt(employeeId),
        title,
        shiftType,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        breakMinutes: breakMinutes || 0,
        notes,
        status: "scheduled",
      })
      .returning()

    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    console.error("Error creating shift:", error)
    return NextResponse.json({ error: "Failed to create shift" }, { status: 500 })
  }
}

