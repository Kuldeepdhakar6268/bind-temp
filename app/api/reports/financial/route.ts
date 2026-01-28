import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, expenses, payments } from "@/lib/db/schema"
import { eq, and, sql, gte, lte } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"

// GET /api/reports/financial - Get financial overview and analytics
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Default to current year if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1)
    const end = endDate ? new Date(endDate) : new Date()

    // Get total revenue from paid invoices
    const revenueResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, session.companyId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, start),
          lte(invoices.paidAt, end)
        )
      )

    const totalRevenue = parseFloat(revenueResult[0]?.total || "0")

    // Get total expenses
    const expensesResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.companyId, session.companyId),
          gte(expenses.expenseDate, start),
          lte(expenses.expenseDate, end)
        )
      )

    const totalExpenses = parseFloat(expensesResult[0]?.total || "0")

    // Get outstanding invoices amount
    const outstandingResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amountDue} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, session.companyId),
          sql`${invoices.status} IN ('sent', 'overdue')`
        )
      )

    const outstandingInvoices = parseFloat(outstandingResult[0]?.total || "0")

    // Count paid invoices
    const paidInvoicesCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, session.companyId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, start),
          lte(invoices.paidAt, end)
        )
      )

    // Count overdue invoices
    const overdueInvoicesCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, session.companyId),
          eq(invoices.status, "overdue")
        )
      )

    // Get revenue by month
    const revenueByMonth = await db
      .select({
        month: sql<string>`TO_CHAR(${invoices.paidAt}, 'Mon YYYY')`,
        amount: sql<string>`COALESCE(SUM(CAST(${invoices.total} AS DECIMAL)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, session.companyId),
          eq(invoices.status, "paid"),
          gte(invoices.paidAt, start),
          lte(invoices.paidAt, end)
        )
      )
      .groupBy(sql`TO_CHAR(${invoices.paidAt}, 'Mon YYYY')`)
      .orderBy(sql`MIN(${invoices.paidAt})`)

    // Get expenses by category
    const expensesByCategory = await db
      .select({
        category: expenses.category,
        amount: sql<string>`COALESCE(SUM(CAST(${expenses.amount} AS DECIMAL)), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.companyId, session.companyId),
          gte(expenses.expenseDate, start),
          lte(expenses.expenseDate, end)
        )
      )
      .groupBy(expenses.category)
      .orderBy(sql`SUM(CAST(${expenses.amount} AS DECIMAL)) DESC`)

    const financialData = {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      outstandingInvoices,
      paidInvoices: Number(paidInvoicesCount[0]?.count || 0),
      overdueInvoices: Number(overdueInvoicesCount[0]?.count || 0),
      revenueByMonth: revenueByMonth.map((item) => ({
        month: item.month,
        amount: parseFloat(item.amount),
      })),
      expensesByCategory: expensesByCategory.map((item) => ({
        category: item.category,
        amount: parseFloat(item.amount),
      })),
    }

    return NextResponse.json(financialData)
  } catch (error) {
    console.error("Error generating financial report:", error)
    return NextResponse.json(
      { error: "Failed to generate financial report" },
      { status: 500 }
    )
  }
}


