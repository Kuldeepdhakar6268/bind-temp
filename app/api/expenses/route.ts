import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { expenses } from "@/lib/db/schema"
import { eq, and, desc, gte, lte, sql } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"

// GET /api/expenses - List all expenses with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    
    const jobId = searchParams.get("jobId")
    const category = searchParams.get("category")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const conditions = [eq(expenses.companyId, session.companyId)]

    if (jobId) {
      conditions.push(eq(expenses.jobId, parseInt(jobId)))
    }

    if (category) {
      conditions.push(eq(expenses.category, category))
    }

    if (startDate) {
      conditions.push(gte(expenses.expenseDate, new Date(startDate)))
    }

    if (endDate) {
      conditions.push(lte(expenses.expenseDate, new Date(endDate)))
    }

    const allExpenses = await db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate))

    return NextResponse.json(allExpenses)
  } catch (error) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    )
  }
}

// POST /api/expenses - Create a new expense
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    
    const {
      category,
      description,
      amount,
      paymentMethod,
      vendor,
      receiptNumber,
      receiptUrl,
      taxDeductible,
      notes,
      expenseDate,
      jobId,
      employeeId,
    } = body

    // Validate required fields
    if (!category || !description || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: category, description, amount" },
        { status: 400 }
      )
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      )
    }

    // Create expense
    const [expense] = await db
      .insert(expenses)
      .values({
        companyId: session.companyId,
        jobId: jobId ? parseInt(jobId) : null,
        employeeId: employeeId ? parseInt(employeeId) : null,
        category,
        description,
        amount: parseFloat(amount).toFixed(2),
        paymentMethod: paymentMethod || null,
        vendor: vendor || null,
        receiptNumber: receiptNumber || null,
        receiptUrl: receiptUrl || null,
        taxDeductible: taxDeductible !== undefined ? (taxDeductible ? 1 : 0) : 1,
        notes: notes || null,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      })
      .returning()

    return NextResponse.json(expense, { status: 201 })
  } catch (error: any) {
    console.error("Error creating expense:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create expense" },
      { status: 500 }
    )
  }
}


