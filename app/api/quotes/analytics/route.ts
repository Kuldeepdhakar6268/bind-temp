import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, gte, lte, sql, desc, count } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/quotes/analytics - Get quote analytics
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

    // Default to current month
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const start = startDate ? new Date(startDate) : defaultStart
    const end = endDate ? new Date(endDate) : defaultEnd

    // Get all quotes for the period
    const quotes = await db.query.quotes.findMany({
      where: and(
        eq(schema.quotes.companyId, session.companyId),
        gte(schema.quotes.createdAt, start),
        lte(schema.quotes.createdAt, end)
      ),
    })

    // Calculate metrics
    const total = quotes.length
    const draft = quotes.filter(q => q.status === "draft").length
    const sent = quotes.filter(q => q.status === "sent").length
    const pending = quotes.filter(q => q.status === "sent" || q.status === "pending").length
    const accepted = quotes.filter(q => q.status === "accepted").length
    const rejected = quotes.filter(q => q.status === "rejected").length
    const converted = quotes.filter(q => q.status === "converted").length
    const expired = quotes.filter(q => q.validUntil && new Date(q.validUntil) < now && q.status === "sent").length

    // Value calculations
    const totalValue = quotes.reduce((sum, q) => sum + parseFloat(q.total || "0"), 0)
    const acceptedValue = quotes.filter(q => q.status === "accepted" || q.status === "converted")
      .reduce((sum, q) => sum + parseFloat(q.total || "0"), 0)
    const pendingValue = quotes.filter(q => q.status === "sent" || q.status === "pending")
      .reduce((sum, q) => sum + parseFloat(q.total || "0"), 0)
    const rejectedValue = quotes.filter(q => q.status === "rejected")
      .reduce((sum, q) => sum + parseFloat(q.total || "0"), 0)

    // Conversion metrics
    const conversionRate = sent > 0 ? ((accepted + converted) / sent) * 100 : 0
    const averageQuoteValue = total > 0 ? totalValue / total : 0

    // Time to accept (for accepted quotes)
    const acceptedQuotes = quotes.filter(q => q.status === "accepted" && q.sentAt && q.acceptedAt)
    let avgTimeToAcceptDays = 0
    if (acceptedQuotes.length > 0) {
      const totalDays = acceptedQuotes.reduce((sum, q) => {
        const sent = new Date(q.sentAt!)
        const accepted = new Date(q.acceptedAt!)
        return sum + (accepted.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24)
      }, 0)
      avgTimeToAcceptDays = totalDays / acceptedQuotes.length
    }

    // Monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthQuotes = quotes.filter(q => {
        const created = new Date(q.createdAt)
        return created >= monthStart && created <= monthEnd
      })

      const monthAccepted = monthQuotes.filter(q => q.status === "accepted" || q.status === "converted")
      
      monthlyTrend.push({
        month: monthStart.toLocaleString("default", { month: "short", year: "2-digit" }),
        total: monthQuotes.length,
        accepted: monthAccepted.length,
        value: monthQuotes.reduce((sum, q) => sum + parseFloat(q.total || "0"), 0),
        acceptedValue: monthAccepted.reduce((sum, q) => sum + parseFloat(q.total || "0"), 0),
      })
    }

    return NextResponse.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      counts: {
        total,
        draft,
        sent,
        pending,
        accepted,
        rejected,
        converted,
        expired,
      },
      values: {
        total: Math.round(totalValue * 100) / 100,
        accepted: Math.round(acceptedValue * 100) / 100,
        pending: Math.round(pendingValue * 100) / 100,
        rejected: Math.round(rejectedValue * 100) / 100,
      },
      metrics: {
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageQuoteValue: Math.round(averageQuoteValue * 100) / 100,
        avgTimeToAcceptDays: Math.round(avgTimeToAcceptDays * 10) / 10,
      },
      monthlyTrend,
    })
  } catch (error) {
    console.error("Error fetching quote analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

