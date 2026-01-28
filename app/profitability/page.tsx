"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Briefcase,
  CalendarDays,
  PieChartIcon,
  BarChart3,
  RefreshCw,
} from "lucide-react"
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns"
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ProfitabilityData {
  period: {
    startDate: string
    endDate: string
  }
  summary: {
    totalRevenue: number
    totalLaborCost: number
    totalExpenses: number
    totalCosts: number
    grossProfit: number
    profitMargin: number
    totalJobs: number
    averageJobValue: number
  }
  breakdown: {
    byCustomer: Array<{ id: string; name: string; revenue: number; jobCount: number }>
    byEmployee: Array<{ id: string; name: string; revenue: number; jobCount: number }>
    expensesByCategory: Array<{ category: string; amount: number }>
  }
}

interface TrendPoint {
  label: string
  revenue: number
  costs: number
  profit: number
}

type PeriodKey = "today" | "this_week" | "this_month" | "custom"

interface TrendBucket {
  label: string
  startDate: Date
  endDate: Date
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export default function ProfitabilityPage() {
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [previousData, setPreviousData] = useState<ProfitabilityData | null>(null)
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>("this_month")
  const [customStart, setCustomStart] = useState(format(new Date(), "yyyy-MM-dd"))
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"))

  const currentRange = useMemo(() => {
    const now = new Date()

    if (period === "today") {
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
      }
    }

    if (period === "this_month") {
      return {
        startDate: startOfDay(startOfMonth(now)),
        endDate: endOfDay(endOfMonth(now)),
      }
    }

    if (period === "custom") {
      const parsedStart = customStart ? startOfDay(new Date(`${customStart}T00:00:00`)) : startOfDay(now)
      const parsedEnd = customEnd ? endOfDay(new Date(`${customEnd}T00:00:00`)) : endOfDay(parsedStart)
      if (parsedStart > parsedEnd) {
        return { startDate: parsedStart, endDate: endOfDay(parsedStart) }
      }
      return { startDate: parsedStart, endDate: parsedEnd }
    }

    const weekStartsOn = 1
    return {
      startDate: startOfDay(startOfWeek(now, { weekStartsOn })),
      endDate: endOfDay(endOfWeek(now, { weekStartsOn })),
    }
  }, [period, customStart, customEnd])

  const previousRange = useMemo(() => {
    const durationDays = Math.max(
      1,
      differenceInCalendarDays(currentRange.endDate, currentRange.startDate) + 1
    )
    const prevEndDate = endOfDay(subDays(currentRange.startDate, 1))
    const prevStartDate = startOfDay(subDays(currentRange.startDate, durationDays))
    return { prevStartDate, prevEndDate }
  }, [currentRange.endDate, currentRange.startDate])

  const rangeLabel = useMemo(() => {
    if (period === "today") return "Today"
    if (period === "this_week") return "This Week"
    if (period === "this_month") return "This Month"
    return `${format(currentRange.startDate, "d MMM yyyy")} - ${format(currentRange.endDate, "d MMM yyyy")}`
  }, [period, currentRange.endDate, currentRange.startDate])

  const buildTrendBuckets = useCallback(
    (startDate: Date, endDate: Date, periodKey: PeriodKey): TrendBucket[] => {
      const durationDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1)
      const weekStartsOn = 1

      const clampEndDate = (candidate: Date) => (candidate > endDate ? endDate : candidate)
      const maxDate = (a: Date, b: Date) => (a > b ? a : b)

      if (periodKey === "today") {
        return [
          {
            label: format(startDate, "EEE d MMM"),
            startDate,
            endDate,
          },
        ]
      }

      const useDailyBuckets = periodKey === "this_week" || durationDays <= 7
      if (useDailyBuckets) {
        const buckets: TrendBucket[] = []
        let cursor = startOfDay(startDate)
        while (cursor <= endDate) {
          const bucketStart = cursor
          const bucketEnd = clampEndDate(endOfDay(bucketStart))
          buckets.push({
            label: format(bucketStart, "EEE d MMM"),
            startDate: bucketStart,
            endDate: bucketEnd,
          })
          cursor = addDays(cursor, 1)
        }
        return buckets
      }

      const useWeeklyBuckets = durationDays <= 45
      if (useWeeklyBuckets) {
        const buckets: TrendBucket[] = []
        let cursor = startOfWeek(startDate, { weekStartsOn })
        while (cursor <= endDate) {
          const bucketStart = maxDate(cursor, startDate)
          const bucketEnd = clampEndDate(endOfWeek(cursor, { weekStartsOn }))
          buckets.push({
            label: `Wk of ${format(bucketStart, "d MMM")}`,
            startDate: bucketStart,
            endDate: bucketEnd,
          })
          cursor = addWeeks(cursor, 1)
        }
        return buckets
      }

      const buckets: TrendBucket[] = []
      let cursor = startOfMonth(startDate)
      while (cursor <= endDate) {
        const bucketStart = maxDate(cursor, startDate)
        const bucketEnd = clampEndDate(endOfMonth(cursor))
        buckets.push({
          label: format(cursor, "MMM yyyy"),
          startDate: bucketStart,
          endDate: bucketEnd,
        })
        cursor = addMonths(cursor, 1)
      }
      return buckets
    },
    []
  )

  const fetchData = useCallback(
    async (
      startDate: Date,
      endDate: Date,
      prevStartDate: Date,
      prevEndDate: Date,
      periodKey: PeriodKey
    ) => {
      try {
        setRefreshing(true)
        setPreviousData(null)
        setTrendData([])

        // Fetch current period data
        const currentRes = await fetch(
          `/api/profitability?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        )
        if (!currentRes.ok) throw new Error("Failed to fetch data")
        const currentData = await currentRes.json()
        setData(currentData)

        // Fetch previous period data for comparison
        const prevRes = await fetch(
          `/api/profitability?startDate=${prevStartDate.toISOString()}&endDate=${prevEndDate.toISOString()}`
        )
        if (prevRes.ok) {
          const prevData = await prevRes.json()
          setPreviousData(prevData)
        }

        // Fetch trend data scoped to the selected range with sensible bucketing
        const buckets = buildTrendBuckets(startDate, endDate, periodKey)
        const bucketResults = await Promise.all(
          buckets.map(async (bucket) => {
            try {
              const res = await fetch(
                `/api/profitability?startDate=${bucket.startDate.toISOString()}&endDate=${bucket.endDate.toISOString()}`
              )
              if (!res.ok) {
                throw new Error(`Failed to fetch trend bucket: ${bucket.label}`)
              }
              const payload: ProfitabilityData = await res.json()
              return {
                label: bucket.label,
                startDate: bucket.startDate,
                revenue: payload.summary.totalRevenue,
                costs: payload.summary.totalCosts,
                profit: payload.summary.grossProfit,
              }
            } catch (error) {
              console.error("Failed to fetch profitability trend bucket:", error)
              return {
                label: bucket.label,
                startDate: bucket.startDate,
                revenue: 0,
                costs: 0,
                profit: 0,
              }
            }
          })
        )

        bucketResults.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        setTrendData(
          bucketResults.map(({ label, revenue, costs, profit }) => ({
            label,
            revenue,
            costs,
            profit,
          }))
        )

      } catch (error) {
        console.error("Error fetching profitability data:", error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [buildTrendBuckets]
  )

  useEffect(() => {
    fetchData(
      currentRange.startDate,
      currentRange.endDate,
      previousRange.prevStartDate,
      previousRange.prevEndDate,
      period
    )
  }, [
    fetchData,
    period,
    currentRange.endDate,
    currentRange.startDate,
    previousRange.prevEndDate,
    previousRange.prevStartDate,
  ])

  function calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const escapeCsvValue = (value: string | number) => {
    const stringValue = String(value ?? "")
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, "\"\"")}"`
    }
    return stringValue
  }

  const handleExport = () => {
    if (!data) return

    const startLabel = format(currentRange.startDate, "yyyy-MM-dd")
    const endLabel = format(currentRange.endDate, "yyyy-MM-dd")

    const lines: Array<Array<string | number>> = [
      ["Profitability Report"],
      ["Range", rangeLabel],
      ["Start Date", startLabel],
      ["End Date", endLabel],
      [],
      ["Summary"],
      ["Metric", "Value"],
      ["Total Revenue", data.summary.totalRevenue.toFixed(2)],
      ["Labor Cost", data.summary.totalLaborCost.toFixed(2)],
      ["Expenses", data.summary.totalExpenses.toFixed(2)],
      ["Total Costs", data.summary.totalCosts.toFixed(2)],
      ["Gross Profit", data.summary.grossProfit.toFixed(2)],
      ["Profit Margin (%)", data.summary.profitMargin.toFixed(2)],
      ["Jobs Completed", data.summary.totalJobs],
      ["Average Job Value", data.summary.averageJobValue.toFixed(2)],
      [],
      ["Revenue by Customer"],
      ["Customer", "Jobs", "Revenue", "Avg Job Value"],
      ...data.breakdown.byCustomer.map((customer) => [
        customer.name,
        customer.jobCount,
        customer.revenue.toFixed(2),
        (customer.jobCount > 0 ? customer.revenue / customer.jobCount : 0).toFixed(2),
      ]),
      [],
      ["Revenue by Employee"],
      ["Employee", "Jobs", "Revenue", "Avg Job Value"],
      ...data.breakdown.byEmployee.map((employee) => [
        employee.name,
        employee.jobCount,
        employee.revenue.toFixed(2),
        (employee.jobCount > 0 ? employee.revenue / employee.jobCount : 0).toFixed(2),
      ]),
      [],
      ["Expenses by Category"],
      ["Category", "Amount"],
      ...data.breakdown.expensesByCategory.map((entry) => [
        entry.category,
        entry.amount.toFixed(2),
      ]),
    ]

    const csvContent = lines
      .map((line) => line.map((value) => escapeCsvValue(value)).join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `profitability-${startLabel}-${endLabel}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const currencyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  function formatCurrency(value: number): string {
    return currencyFormatter.format(value ?? 0)
  }

  const profitChange = previousData 
    ? calculateChange(data?.summary.grossProfit || 0, previousData.summary.grossProfit)
    : 0

  const revenueChange = previousData
    ? calculateChange(data?.summary.totalRevenue || 0, previousData.summary.totalRevenue)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderClient />
        <main className="p-4 md:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48 mt-2" />
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4 md:p-6">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-24 mt-3" />
                <Skeleton className="h-8 w-32 mt-2" />
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-4 md:p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-[250px] md:h-[300px] w-full" />
            </Card>
            <Card className="p-4 md:p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-[250px] md:h-[300px] w-full" />
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Profitability Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Track profit margins and financial performance
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={period === "today" ? "default" : "outline"}
                  onClick={() => setPeriod("today")}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={period === "this_week" ? "default" : "outline"}
                  onClick={() => setPeriod("this_week")}
                >
                  This Week
                </Button>
                <Button
                  size="sm"
                  variant={period === "this_month" ? "default" : "outline"}
                  onClick={() => setPeriod("this_month")}
                >
                  This Month
                </Button>
                <Button
                  size="sm"
                  variant={period === "custom" ? "default" : "outline"}
                  onClick={() => setPeriod("custom")}
                >
                  Custom Range
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    fetchData(
                      currentRange.startDate,
                      currentRange.endDate,
                      previousRange.prevStartDate,
                      previousRange.prevEndDate,
                      period
                    )
                  }
                  disabled={refreshing}
                  aria-label="Refresh profitability data"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:hidden"
                  onClick={handleExport}
                  disabled={refreshing || !data}
                  aria-label="Export profitability report"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex"
                  onClick={handleExport}
                  disabled={refreshing || !data}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              {period === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Range
                  </div>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-9 w-[150px]"
                    aria-label="Custom start date"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-9 w-[150px]"
                    aria-label="Custom end date"
                  />
                </div>
              )}
              <div className="text-xs text-muted-foreground">{rangeLabel}</div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Gross Profit Card */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              </div>
              {profitChange !== 0 && (
                <Badge 
                  variant={profitChange > 0 ? "default" : "destructive"} 
                  className="text-xs"
                >
                  {profitChange > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {profitChange > 0 ? "+" : ""}{profitChange.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="mt-3">
              <p className="text-xs md:text-sm text-muted-foreground">Gross Profit</p>
              <p className="text-lg md:text-2xl font-bold">
                {formatCurrency(data?.summary.grossProfit || 0)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
              vs previous period
            </p>
          </Card>

          {/* Profit Margin Card */}
          <Card className="p-4 md:p-6">
            <div className="p-2 bg-blue-500/10 rounded-lg w-fit">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
            </div>
            <div className="mt-3">
              <p className="text-xs md:text-sm text-muted-foreground">Profit Margin</p>
              <p className="text-lg md:text-2xl font-bold">
                {(data?.summary.profitMargin || 0).toFixed(1)}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
              Industry avg: 35%
            </p>
          </Card>

          {/* Total Revenue Card */}
          <Card className="p-4 md:p-6">
            <div className="flex items-start justify-between">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Briefcase className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
              </div>
              {revenueChange !== 0 && (
                <Badge 
                  variant={revenueChange > 0 ? "default" : "secondary"} 
                  className="text-xs hidden sm:flex"
                >
                  {revenueChange > 0 ? "+" : ""}{revenueChange.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="mt-3">
              <p className="text-xs md:text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-lg md:text-2xl font-bold">
                {formatCurrency(data?.summary.totalRevenue || 0)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
              {data?.summary.totalJobs || 0} jobs completed
            </p>
          </Card>

          {/* Total Costs Card */}
          <Card className="p-4 md:p-6">
            <div className="p-2 bg-orange-500/10 rounded-lg w-fit">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
            </div>
            <div className="mt-3">
              <p className="text-xs md:text-sm text-muted-foreground">Total Costs</p>
              <p className="text-lg md:text-2xl font-bold">
                {formatCurrency(data?.summary.totalCosts || 0)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
              Labor: {formatCurrency(data?.summary.totalLaborCost || 0)}
            </p>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Revenue vs Profit Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                Revenue & Profit Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                      tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2} 
                      name="Revenue"
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2} 
                      name="Profit"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No trend data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 md:h-5 md:w-5" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data?.breakdown.expensesByCategory && data.breakdown.expensesByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.breakdown.expensesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percent }) => 
                        percent > 0.05 ? `${category} ${(percent * 100).toFixed(0)}%` : ""
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                      nameKey="category"
                    >
                      {data.breakdown.expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                  <PieChartIcon className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">No expenses recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer Revenue Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Revenue by Customer</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.breakdown.byCustomer && data.breakdown.byCustomer.length > 0 ? (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {data.breakdown.byCustomer.slice(0, 10).map((customer, index) => (
                    <div 
                      key={customer.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.jobCount} jobs</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{formatCurrency(customer.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-sm">#</th>
                        <th className="text-left py-3 px-4 font-medium text-sm">Customer</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Jobs</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Revenue</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Avg/Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdown.byCustomer.slice(0, 10).map((customer, index) => (
                        <tr key={customer.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 text-muted-foreground">{index + 1}</td>
                          <td className="py-3 px-4 font-medium">{customer.name}</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant="secondary">{customer.jobCount}</Badge>
                          </td>
                          <td className="text-right py-3 px-4 font-semibold text-green-600">
                            {formatCurrency(customer.revenue)}
                          </td>
                          <td className="text-right py-3 px-4 text-muted-foreground">
                            {formatCurrency(customer.jobCount > 0 ? customer.revenue / customer.jobCount : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No customer revenue data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Revenue Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg">Revenue by Employee</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.breakdown.byEmployee && data.breakdown.byEmployee.length > 0 ? (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {data.breakdown.byEmployee.slice(0, 10).map((employee, index) => (
                    <div 
                      key={employee.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.jobCount} jobs</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{formatCurrency(employee.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-sm">#</th>
                        <th className="text-left py-3 px-4 font-medium text-sm">Employee</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Jobs</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Revenue</th>
                        <th className="text-right py-3 px-4 font-medium text-sm">Avg/Job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdown.byEmployee.slice(0, 10).map((employee, index) => (
                        <tr key={employee.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 text-muted-foreground">{index + 1}</td>
                          <td className="py-3 px-4 font-medium">{employee.name}</td>
                          <td className="text-right py-3 px-4">
                            <Badge variant="secondary">{employee.jobCount}</Badge>
                          </td>
                          <td className="text-right py-3 px-4 font-semibold text-green-600">
                            {formatCurrency(employee.revenue)}
                          </td>
                          <td className="text-right py-3 px-4 text-muted-foreground">
                            {formatCurrency(employee.jobCount > 0 ? employee.revenue / employee.jobCount : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No employee revenue data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Footer */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Avg Job Value</p>
            <p className="text-lg md:text-xl font-bold mt-1">
              {formatCurrency(data?.summary.averageJobValue || 0)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Jobs</p>
            <p className="text-lg md:text-xl font-bold mt-1">
              {data?.summary.totalJobs || 0}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Labor Cost</p>
            <p className="text-lg md:text-xl font-bold mt-1">
              {formatCurrency(data?.summary.totalLaborCost || 0)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Other Expenses</p>
            <p className="text-lg md:text-xl font-bold mt-1">
              {formatCurrency(data?.summary.totalExpenses || 0)}
            </p>
          </Card>
        </div>
      </main>
    </div>
  )
}

