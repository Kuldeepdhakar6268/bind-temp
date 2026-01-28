"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  ResponsiveContainer,
} from "recharts"
import { Loader2 } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"

interface RevenueData {
  month: string
  revenue: number
}

interface JobsCategoryData {
  category: string
  count: number
  name?: string
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function ReportsCharts() {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [jobsData, setJobsData] = useState<JobsCategoryData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
    const interval = setInterval(fetchReportData, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  const fetchReportData = async () => {
    try {
      // Fetch revenue data from invoices
      const invoicesRes = await fetch("/api/invoices")
      const invoices = invoicesRes.ok ? await invoicesRes.json() : []
      
      // Calculate monthly revenue for last 6 months
      const monthlyRevenue: Record<string, number> = {}
      const now = new Date()
      
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i)
        const monthKey = format(monthDate, "MMM")
        monthlyRevenue[monthKey] = 0
      }
      
      invoices.forEach((invoice: any) => {
        if (invoice.status === "paid" && invoice.paidAt) {
          const paidDate = new Date(invoice.paidAt)
          const monthKey = format(paidDate, "MMM")
          if (monthlyRevenue.hasOwnProperty(monthKey)) {
            monthlyRevenue[monthKey] += parseFloat(invoice.total) || 0
          }
        }
      })
      
      const revenueChartData: RevenueData[] = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue: Math.round(revenue * 100) / 100,
      }))
      
      setRevenueData(revenueChartData)
      
      // Fetch jobs for category breakdown
      const jobsRes = await fetch("/api/jobs")
      const jobs = jobsRes.ok ? await jobsRes.json() : []
      
      // Group jobs by type/category
      const jobsByCategory: Record<string, number> = {}
      jobs.forEach((job: any) => {
        const category = job.type || job.category || "General"
        jobsByCategory[category] = (jobsByCategory[category] || 0) + 1
      })
      
      const jobsCategoryData: JobsCategoryData[] = Object.entries(jobsByCategory)
        .map(([category, count]) => ({
          category,
          name: category,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      
      // If no data, show placeholder
      if (jobsCategoryData.length === 0) {
        jobsCategoryData.push({ category: "No Jobs", name: "No Jobs", count: 1 })
      }
      
      setJobsData(jobsCategoryData)
    } catch (error) {
      console.error("Failed to fetch report data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value) => `£${value}`}
              />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jobs by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={jobsData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {jobsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
