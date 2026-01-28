import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/profitability - Get profitability analysis
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const customerId = searchParams.get("customerId")
    const employeeId = searchParams.get("employeeId")

    // Default to current month if no dates provided
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    defaultStart.setHours(0, 0, 0, 0)
    defaultEnd.setHours(23, 59, 59, 999)
    
    const start = startDate ? new Date(startDate) : defaultStart
    const end = endDate ? new Date(endDate) : defaultEnd

    // Get revenue from completed jobs
    const jobConditions: any[] = [
      eq(schema.jobs.companyId, session.companyId),
      eq(schema.jobs.status, "completed"),
    ]
    // Only add completedAt filter if job has completedAt set
    if (customerId) jobConditions.push(eq(schema.jobs.customerId, parseInt(customerId)))
    if (employeeId) jobConditions.push(eq(schema.jobs.assignedTo, parseInt(employeeId)))

    const jobs = await db.query.jobs.findMany({
      where: and(...jobConditions),
      with: {
        customer: true,
        assignee: true,
      },
    })

    // Filter by completed date in JavaScript since completedAt can be null
    const filteredJobs = jobs.filter(job => {
      if (!job.completedAt) return false
      const completedAt = new Date(job.completedAt)
      return completedAt >= start && completedAt <= end
    })

    const totalRevenue = filteredJobs.reduce((sum, job) => {
      return sum + (job.actualPrice ? parseFloat(job.actualPrice) : (job.estimatedPrice ? parseFloat(job.estimatedPrice) : 0))
    }, 0)

    // Get labor costs from work sessions
    const sessionConditions: any[] = []
    if (employeeId) sessionConditions.push(eq(schema.workSessions.employeeId, parseInt(employeeId)))

    const workSessions = await db.query.workSessions.findMany({
      where: sessionConditions.length > 0 ? and(...sessionConditions) : undefined,
      with: {
        employee: true,
      },
    })

    // Filter work sessions by employee's company and date range
    const filteredSessions = workSessions.filter((ws: any) => {
      if (!ws.employee || Array.isArray(ws.employee)) return false
      if (ws.employee.companyId !== session.companyId) return false
      if (!ws.startedAt) return false
      const sessionDate = new Date(ws.startedAt)
      return sessionDate >= start && sessionDate <= end
    })

    let totalLaborCost = 0
    for (const ws of filteredSessions) {
      // Calculate hours from startedAt and endedAt
      let hours = 0
      if (ws.startedAt && ws.endedAt) {
        hours = (new Date(ws.endedAt).getTime() - new Date(ws.startedAt).getTime()) / (1000 * 60 * 60)
      } else if (ws.durationMinutes) {
        hours = ws.durationMinutes / 60
      }
      const employee = ws.employee as any
      const rate = employee?.hourlyRate ? parseFloat(employee.hourlyRate) : 0
      totalLaborCost += hours * rate
    }

    // Get expenses
    const expenseConditions = [
      eq(schema.expenses.companyId, session.companyId),
      gte(schema.expenses.expenseDate, start),
      lte(schema.expenses.expenseDate, end),
    ]

    const expenses = await db.query.expenses.findMany({
      where: and(...expenseConditions),
    })

    const totalExpenses = expenses.reduce((sum, exp) => {
      return sum + (exp.amount ? parseFloat(exp.amount) : 0)
    }, 0)

    // Calculate profit
    const totalCosts = totalLaborCost + totalExpenses
    const grossProfit = totalRevenue - totalCosts
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // Revenue by customer
    const revenueByCustomer = filteredJobs.reduce((acc, job) => {
      const customerId = job.customerId?.toString() || "unknown"
      const customer = job.customer as any
      const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Unknown Customer" : "Unknown Customer"
      if (!acc[customerId]) {
        acc[customerId] = { id: customerId, name: customerName, revenue: 0, jobCount: 0 }
      }
      acc[customerId].revenue += job.actualPrice ? parseFloat(job.actualPrice) : (job.estimatedPrice ? parseFloat(job.estimatedPrice) : 0)
      acc[customerId].jobCount++
      return acc
    }, {} as Record<string, { id: string; name: string; revenue: number; jobCount: number }>)

    // Revenue by employee
    const revenueByEmployee = filteredJobs.reduce((acc, job) => {
      const employeeId = job.assignedTo?.toString() || "unassigned"
      const assignee = job.assignee as any
      const employeeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : "Unassigned"
      if (!acc[employeeId]) {
        acc[employeeId] = { id: employeeId, name: employeeName, revenue: 0, jobCount: 0 }
      }
      acc[employeeId].revenue += job.actualPrice ? parseFloat(job.actualPrice) : (job.estimatedPrice ? parseFloat(job.estimatedPrice) : 0)
      acc[employeeId].jobCount++
      return acc
    }, {} as Record<string, { id: string; name: string; revenue: number; jobCount: number }>)

    // Expense breakdown by category
    const expensesByCategory = expenses.reduce((acc, exp) => {
      const category = exp.category || "uncategorized"
      if (!acc[category]) acc[category] = 0
      acc[category] += exp.amount ? parseFloat(exp.amount) : 0
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalLaborCost: Math.round(totalLaborCost * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        totalCosts: Math.round(totalCosts * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        profitMargin: Math.round(profitMargin * 100) / 100,
        totalJobs: filteredJobs.length,
        averageJobValue: filteredJobs.length > 0 ? Math.round((totalRevenue / filteredJobs.length) * 100) / 100 : 0,
      },
      breakdown: {
        byCustomer: Object.values(revenueByCustomer).sort((a, b) => b.revenue - a.revenue),
        byEmployee: Object.values(revenueByEmployee).sort((a, b) => b.revenue - a.revenue),
        expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
          category,
          amount: Math.round(amount * 100) / 100,
        })).sort((a, b) => b.amount - a.amount),
      },
    })
  } catch (error) {
    console.error("Error calculating profitability:", error)
    return NextResponse.json({ error: "Failed to calculate profitability" }, { status: 500 })
  }
}

