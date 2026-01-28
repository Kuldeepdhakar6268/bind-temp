"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Users, Calendar, CheckCircle2, AlertCircle, DollarSign, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardStats {
  totalRevenue: number
  revenueChange: number
  activeJobs: number
  jobsChange: number
  staffOnDuty: number
  staffChange: number
  completionRate: number
  completionChange: number
  pendingTasks: number
  pendingChange: number
  totalHours: number
  hoursChange: number
}

export function StatsOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const [jobsRes, employeesRes, invoicesRes, workSessionsRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/employees?status=active"),
        fetch("/api/invoices"),
        fetch("/api/work-sessions"),
      ])

      const jobs = jobsRes.ok ? await jobsRes.json() : []
      const employees = employeesRes.ok ? await employeesRes.json() : []
      const invoices = invoicesRes.ok ? await invoicesRes.json() : []
      const workSessions = workSessionsRes.ok ? await workSessionsRes.json() : []

      const now = new Date()
      const thisMonth = now.getMonth()
      const thisYear = now.getFullYear()
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

      const thisMonthInvoices = invoices.filter((inv: any) => {
        const date = new Date(inv.createdAt)
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear
      })
      const lastMonthInvoices = invoices.filter((inv: any) => {
        const date = new Date(inv.createdAt)
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
      })
      
      const thisMonthRevenue = thisMonthInvoices
        .filter((inv: any) => inv.status === "paid")
        .reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"), 0)
      const lastMonthRevenue = lastMonthInvoices
        .filter((inv: any) => inv.status === "paid")
        .reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"), 0)
      const revenueChange = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0

      const activeJobs = jobs.filter((job: any) => 
        job.status === "scheduled" || job.status === "in-progress"
      ).length

      const staffOnDuty = employees.filter((emp: any) => emp.status === "active").length

      const completedJobs = jobs.filter((job: any) => job.status === "completed").length
      const totalJobs = jobs.length
      const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0

      const pendingTasks = jobs.filter((job: any) => job.status === "scheduled").length

      const thisMonthSessions = workSessions.filter((session: any) => {
        const date = new Date(session.startTime)
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear
      })
      const totalHours = thisMonthSessions.reduce((sum: number, session: any) => {
        if (session.endTime) {
          const start = new Date(session.startTime)
          const end = new Date(session.endTime)
          return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        }
        return sum
      }, 0)

      setStats({
        totalRevenue: thisMonthRevenue,
        revenueChange,
        activeJobs,
        jobsChange: 0,
        staffOnDuty,
        staffChange: 0,
        completionRate,
        completionChange: 0,
        pendingTasks,
        pendingChange: 0,
        totalHours: Math.round(totalHours),
        hoursChange: 0,
      })
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      title: "Total Revenue",
      value: `£${(stats?.totalRevenue || 0).toLocaleString()}`,
      change: `${(stats?.revenueChange || 0) >= 0 ? "+" : ""}${stats?.revenueChange?.toFixed(1) || 0}%`,
      trend: (stats?.revenueChange || 0) >= 0 ? "up" : "down",
      icon: DollarSign,
      description: "This month",
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      title: "Active Jobs",
      value: String(stats?.activeJobs || 0),
      change: `${stats?.activeJobs || 0} active`,
      trend: "up",
      icon: Calendar,
      description: "Scheduled & in-progress",
      color: "bg-chart-1/10 text-chart-1",
    },
    {
      title: "Staff On Duty",
      value: String(stats?.staffOnDuty || 0),
      change: "Active",
      trend: "up",
      icon: Users,
      description: "Active employees",
      color: "bg-chart-4/10 text-chart-4",
    },
    {
      title: "Completion Rate",
      value: `${(stats?.completionRate || 0).toFixed(1)}%`,
      change: (stats?.completionRate || 0) >= 90 ? "Good" : "Needs attention",
      trend: (stats?.completionRate || 0) >= 90 ? "up" : "down",
      icon: CheckCircle2,
      description: "All time",
      color: "bg-chart-2/10 text-chart-2",
    },
    {
      title: "Pending Tasks",
      value: String(stats?.pendingTasks || 0),
      change: `${stats?.pendingTasks || 0} scheduled`,
      trend: (stats?.pendingTasks || 0) < 10 ? "down" : "up",
      icon: AlertCircle,
      description: "Requires attention",
      color: "bg-destructive/10 text-destructive",
    },
    {
      title: "Total Hours",
      value: (stats?.totalHours || 0).toLocaleString(),
      change: "This month",
      trend: "up",
      icon: Clock,
      description: "Logged this month",
      color: "bg-chart-3/10 text-chart-3",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {statItems.map((stat) => {
        const Icon = stat.icon
        const isPositive = stat.trend === "up" && !stat.title.includes("Pending")
        const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown

        return (
          <Card key={stat.title} className="p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  isPositive ? "text-chart-2" : "text-destructive",
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
              <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
