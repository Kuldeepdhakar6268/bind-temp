import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, and, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/contracts - List all contracts for the company
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const contracts = await db.query.contracts.findMany({
      where: eq(schema.contracts.companyId, session.companyId),
      with: {
        customer: true,
      },
      orderBy: [desc(schema.contracts.createdAt)],
    })

    return NextResponse.json(contracts)
  } catch (error) {
    console.error("Error fetching contracts:", error)
    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 })
  }
}

// POST /api/contracts - Create a new contract
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
      customerId,
      quoteId,
      title,
      description,
      frequency,
      startDate,
      endDate,
      autoRenew,
      amount,
      billingFrequency,
      notes,
      terms,
      scheduleDays,
      hoursPerWeek,
      hourlyRate,
      annualValue,
      employeeIds,
    } = body

    if (!customerId || !title || !frequency || !startDate || !endDate || !amount) {
      return NextResponse.json(
        { error: "Customer, title, frequency, start date, end date, and amount are required" },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 })
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) {
      return NextResponse.json({ error: "End date cannot be in the past" }, { status: 400 })
    }

    // Generate contract number
    const existingContracts = await db.query.contracts.findMany({
      where: eq(schema.contracts.companyId, session.companyId),
    })
    const contractNumber = `C-${new Date().getFullYear()}-${String(existingContracts.length + 1).padStart(4, "0")}`

    const parsedEmployeeIds = Array.isArray(employeeIds)
      ? employeeIds
          .map((id: unknown) => parseInt(String(id)))
          .filter((id: number) => Number.isFinite(id))
      : []
    const validEmployeeIds = parsedEmployeeIds.length
      ? (
          await db.query.employees.findMany({
            where: and(
              eq(schema.employees.companyId, session.companyId),
              inArray(schema.employees.id, parsedEmployeeIds)
            ),
            columns: { id: true },
          })
        ).map((employee) => employee.id)
      : []

    const [contract] = await db
      .insert(schema.contracts)
      .values({
        companyId: session.companyId,
        customerId,
        quoteId: quoteId || null,
        contractNumber,
        title,
        description,
        frequency,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        autoRenew: autoRenew ? 1 : 0,
        amount: amount.toString(),
        billingFrequency,
        notes,
        terms,
        status: "draft",
        scheduleDays: scheduleDays || [],
        hoursPerWeek: hoursPerWeek ? hoursPerWeek.toString() : null,
        hourlyRate: hourlyRate ? hourlyRate.toString() : null,
        annualValue: annualValue ? annualValue.toString() : null,
        employeeIds: validEmployeeIds,
      })
      .returning()

    return NextResponse.json(contract, { status: 201 })
  } catch (error) {
    console.error("Error creating contract:", error)
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 })
  }
}

