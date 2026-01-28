"use client"

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  DollarSign, 
  Clock, 
  Loader2,
  RefreshCw,
  Briefcase,
  Camera,
  Target,
  ArrowRight,
  XCircle,
  Plus,
  FileText,
  Receipt,
  CreditCard,
  Bell,
  ChevronRight,
  Eye,
  Zap,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow, startOfMonth, subDays } from "date-fns"
import { DateRange } from "react-day-picker"

// ===== TYPES =====
interface DashboardStats {
  totalRevenue: number
  revenueChange: number
  previousRevenue: number
  activeJobs: number
  periodJobs: number
  completedJobs: number
  completedJobsChange: number
  scheduledJobs: number
  completionRate: number
  completionRateAllTime?: number
  periodCompletionRate: number
  completionRateChange: number
  activeEmployees: number
  pendingTasks: number
  overdueJobs: number
  totalPhotos: number
  pendingPhotos: number
}

interface PeriodInfo {
  type: string
  startDate: string
  endDate: string
  previousStartDate: string
  previousEndDate: string
}

interface CleaningPlan {
  id: number
  name: string
  category: string | null
  estimatedDuration: string | null
}

// Period options
const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

// ===== DASHBOARD CONTEXT =====
interface DashboardContextType {
  period: string
  dateRange: DateRange | undefined
  setPeriod: (period: string) => void
  setDateRange: (range: DateRange | undefined) => void
  stats: DashboardStats | null
  loading: boolean
  lastUpdated: Date | null
  refresh: () => void
}

const DashboardContext = createContext<DashboardContextType | null>(null)

function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) throw new Error("useDashboard must be used within DashboardProvider")
  return context
}

// ===== MAIN COMPONENT =====
export function OverviewDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  })
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // Fetch stats
  const fetchStats = useCallback(async () => {
    setRefreshing(true)
    try {
      let url = `/api/dashboard/stats?period=${selectedPeriod}`
      if (selectedPeriod === "custom" && dateRange?.from && dateRange?.to) {
        url += `&startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
      }

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setPeriodInfo(data.period)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedPeriod, dateRange])

  // Initial fetch and polling
  useEffect(() => {
    fetchStats()
    
    // Poll for updates every 30 seconds
    const statsInterval = setInterval(fetchStats, 30000)
    
    return () => {
      clearInterval(statsInterval)
    }
  }, [fetchStats])

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value)
  }

  const getPeriodLabel = () => {
    if (!periodInfo) return ""
    const start = new Date(periodInfo.startDate)
    const end = new Date(periodInfo.endDate)
    if (selectedPeriod === "today") return format(start, "MMMM d, yyyy")
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
  }

  // Loading state
  if (loading) {
    return (
      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-4 w-24 mt-4" />
              <Skeleton className="h-8 w-32 mt-2" />
            </Card>
          ))}
        </div>
      </main>
    )
  }

  return (
    <DashboardContext.Provider value={{
      period: selectedPeriod,
      dateRange,
      setPeriod: handlePeriodChange,
      setDateRange,
      stats,
      loading,
      lastUpdated,
      refresh: fetchStats,
    }}>
      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header with Date Range Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Monitor your cleaning operations in real-time
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-40 md:w-44">
                <CalendarIcon className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPeriod === "custom" && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Custom range</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const value = e.target.value
                      setDateRange((prev) => ({
                        from: value ? new Date(`${value}T00:00:00`) : undefined,
                        to: prev?.to,
                      }))
                    }}
                    className="h-9 w-full sm:w-[160px]"
                  />
                  <Input
                    type="date"
                    value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const value = e.target.value
                      setDateRange((prev) => ({
                        from: prev?.from,
                        to: value ? new Date(`${value}T23:59:59`) : undefined,
                      }))
                    }}
                    className="h-9 w-full sm:w-[160px]"
                  />
                </div>
              </div>
            )}

            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchStats}
              disabled={refreshing}
              className="shrink-0"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>

            {lastUpdated && (
              <Badge variant="outline" className="text-xs text-muted-foreground hidden md:flex">
                Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </Badge>
            )}
          </div>
        </div>

        {/* Main Stats Grid - All Clickable */}
        <StatsGrid stats={stats} periodLabel={getPeriodLabel()} />

        {/* Quick Actions */}
        <div>
          <QuickActionsPanel />
        </div>

        {/* Today's Tasks Table */}
        <div className="grid gap-6">
          <TodaysTasksTable />
        </div>

        {/* Financial Overview + Verification */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FinancialQuickView />
          <VerificationStatusWidget 
            totalPhotos={stats?.totalPhotos || 0} 
            pendingPhotos={stats?.pendingPhotos || 0} 
          />
        </div>
      </main>
    </DashboardContext.Provider>
  )
}

// ===== TODAY'S TASKS TABLE =====
function TodaysTasksTable() {
  const router = useRouter()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  const fetchTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/jobs?filter=today")
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 60000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchTerm = search.toLowerCase()
      const matchesFilter = filter === "all" || task.status?.toLowerCase() === filter
      const customerName = [task.customer?.firstName, task.customer?.lastName].filter(Boolean).join(" ")
      const matchesSearch =
        customerName.toLowerCase().includes(searchTerm) ||
        task.location?.toLowerCase().includes(searchTerm) ||
        task.assignee?.firstName?.toLowerCase().includes(searchTerm) ||
        task.assignee?.lastName?.toLowerCase().includes(searchTerm) ||
        task.title?.toLowerCase().includes(searchTerm)
      return matchesFilter && matchesSearch
    })
  }, [tasks, filter, search])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
      case "in-progress": return "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
      case "scheduled": return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
      case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date)
  }

  const formatTime = (value: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Today's Tasks
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  className="pl-8 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-9 w-9"
                  onClick={fetchTasks}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </Button>
                <Button 
                  size="sm"
                  className="gap-2 h-9"
                  onClick={() => router.push("/scheduling?new=true")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Task</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No tasks scheduled for today
                <Button
                  variant="link"
                  className="block mx-auto mt-2"
                  onClick={() => router.push("/scheduling?new=true")}
                >
                  Schedule a new job
                </Button>
              </div>
            ) : (
              filteredTasks.map((task, index) => {
                const customerName =
                  [task.customer?.firstName, task.customer?.lastName].filter(Boolean).join(" ") ||
                  "Unknown Customer"
                return (
                <div
                  key={task.id ?? index}
                  className="rounded-lg border p-3"
                  onClick={() => router.push(`/jobs/${task.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      router.push(`/jobs/${task.id}`)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{task.title || "Untitled job"}</div>
                      <div className="text-sm text-muted-foreground">
                        {customerName}
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {task.status || "pending"}
                    </Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    <div>{task.location || "Location not set"}</div>
                    <div>
                      Staff: {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : "Unassigned"}
                    </div>
                    <div>
                      {formatDate(task.scheduledFor)} at {formatTime(task.scheduledFor)}
                    </div>
                  </div>
                </div>
                )
              })
            )}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-3 font-medium">Client</th>
                  <th className="pb-3 font-medium">Location</th>
                  <th className="pb-3 font-medium">Staff</th>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No tasks scheduled for today
                      <Button 
                        variant="link" 
                        className="block mx-auto mt-2"
                        onClick={() => router.push("/scheduling?new=true")}
                      >
                        Schedule a new job
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr 
                      key={task.id} 
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/jobs/${task.id}`)}
                    >
                      <td className="py-3 font-medium">
                        {[task.customer?.firstName, task.customer?.lastName].filter(Boolean).join(" ") || "Unknown Customer"}
                      </td>
                      <td className="py-3 text-muted-foreground">{task.location || "—"}</td>
                      <td className="py-3">
                        {task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : "Unassigned"}
                      </td>
                      <td className="py-3">{formatDate(task.scheduledFor)}</td>
                      <td className="py-3">{formatTime(task.scheduledFor)}</td>
                      <td className="py-3">
                        <Badge variant="outline" className={getStatusColor(task.status)}>
                          {task.status || "pending"}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {tasks.length > 0 && (
            <Button 
              variant="ghost" 
              className="w-full mt-4" 
              onClick={() => router.push("/scheduling")}
            >
              View all scheduled jobs
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ===== STATS GRID =====
function StatsGrid({ stats, periodLabel }: { stats: DashboardStats | null; periodLabel: string }) {
  const router = useRouter()

  const statItems = [
    {
      title: "Total Revenue",
      value: `GBP ${(stats?.totalRevenue || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: stats?.revenueChange || 0,
      changeLabel: `${(stats?.revenueChange || 0) >= 0 ? "+" : ""}${stats?.revenueChange?.toFixed(1) || 0}%`,
      trend: (stats?.revenueChange || 0) >= 0 ? "up" : "down",
      icon: DollarSign,
      description: periodLabel,
      subText: stats?.previousRevenue ? `vs GBP ${stats.previousRevenue.toLocaleString()} prev` : null,
      color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
      href: "/invoicing",
    },
    {
      title: "Active Jobs",
      value: String(stats?.activeJobs || 0),
      change: stats?.completedJobsChange || 0,
      changeLabel: `${stats?.completedJobs || 0} completed`,
      trend: "up",
      icon: Briefcase,
      description: "Scheduled & in-progress",
      subText: `${stats?.scheduledJobs || 0} scheduled`,
      color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      href: "/scheduling",
    },
    {
      title: "Completion Rate",
      value: `${(stats?.completionRate || 0).toFixed(1)}%`,
      change: stats?.completionRateChange || 0,
      changeLabel: (stats?.completionRate || 0) >= 80 ? "Good" : "Needs attention",
      trend: (stats?.completionRate || 0) >= 80 ? "up" : "down",
      icon: Target,
      description: periodLabel,
      subText: stats?.completionRateAllTime !== undefined
        ? `All-time ${stats.completionRateAllTime.toFixed(1)}%`
        : null,
      color: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
      href: "/verification-center",
    },
    {
      title: "Overdue Jobs",
      value: String(stats?.overdueJobs || 0),
      change: stats?.overdueJobs || 0,
      changeLabel: (stats?.overdueJobs || 0) === 0 ? "All on time" : "Needs attention",
      trend: (stats?.overdueJobs || 0) === 0 ? "down" : "up",
      icon: AlertCircle,
      description: periodLabel,
      subText: stats?.pendingPhotos ? `${stats.pendingPhotos} photos to verify` : null,
      color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      href: "/scheduling",
    },
  ]

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {statItems.map((stat) => {
        const Icon = stat.icon
        const isNegativeStat = stat.title.includes("Pending") || stat.title.includes("Overdue")
        const isPositive = stat.trend === "up" && !isNegativeStat
        const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown

        return (
          <Card 
            key={stat.title} 
            className="p-4 md:p-5 hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary"
            onClick={() => router.push(stat.href)}
          >
            <div className="flex items-start justify-between">
              <div className={cn("flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-xl", stat.color)}>
                <Icon className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div
                className={cn(
                  "hidden sm:flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                  isPositive ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
                )}
              >
                <TrendIcon className="h-3 w-3" />
                <span className="hidden lg:inline">{stat.changeLabel}</span>
              </div>
            </div>
            <div className="mt-3 md:mt-4">
              <p className="text-xs md:text-sm font-medium text-muted-foreground">{stat.title}</p>
              <h3 className="text-lg md:text-2xl font-bold mt-1 group-hover:text-primary transition-colors">{stat.value}</h3>
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{stat.description}</p>
              {stat.subText && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 hidden md:block">{stat.subText}</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
          </Card>
        )
      })}
    </div>
  )
}

// ===== QUICK ACTIONS PANEL =====
function QuickActionsPanel() {
  const router = useRouter()

  const actions = [
    { label: "New Job", icon: Plus, href: "/scheduling?new=true", color: "bg-blue-500 hover:bg-blue-600" },
    { label: "New Customer", icon: Users, href: "/customers?new=true", color: "bg-emerald-500 hover:bg-emerald-600" },
    { label: "Create Invoice", icon: FileText, href: "/invoicing?new=true", color: "bg-violet-500 hover:bg-violet-600" },
    { label: "Send Message", icon: Bell, href: "/messages", color: "bg-amber-500 hover:bg-amber-600" },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common tasks at your fingertips</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.label}
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              onClick={() => router.push(action.href)}
            >
              <div className={cn("p-1.5 rounded-md text-white", action.color)}>
                <Icon className="h-4 w-4" />
              </div>
              {action.label}
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ===== FINANCIAL QUICK VIEW =====
function FinancialQuickView() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFinancial = async () => {
      try {
        const res = await fetch("/api/reports/financial")
        if (res.ok) {
          setData(await res.json())
        }
      } catch (error) {
        console.error("Failed to fetch financial data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchFinancial()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const items = [
    { label: "Total Revenue", value: data?.totalRevenue || 0, icon: DollarSign, color: "text-emerald-500", href: "/invoicing" },
    { label: "Outstanding", value: data?.outstandingInvoices || 0, icon: AlertCircle, color: "text-amber-500", href: "/invoicing?filter=unpaid" },
    { label: "Expenses", value: data?.totalExpenses || 0, icon: Receipt, color: "text-orange-500", href: "/expenses" },
    { label: "Net Profit", value: data?.netProfit || 0, icon: TrendingUp, color: data?.netProfit >= 0 ? "text-emerald-500" : "text-red-500", href: "/profitability" },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Financial Overview
          </CardTitle>
          <CardDescription>Your financial snapshot</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/profitability")}>
          Details
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div 
              key={item.label}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => router.push(item.href)}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4", item.color)} />
                <span className="text-sm text-muted-foreground">{item.label}</span>
              </div>
              <span className={cn("font-semibold", item.color)}>
                GBP {item.value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )
        })}
        {data?.overdueInvoices > 0 && (
          <div 
            className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer"
            onClick={() => router.push("/invoicing?filter=overdue")}
          >
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{data.overdueInvoices} overdue invoice{data.overdueInvoices !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== VERIFICATION STATUS WIDGET =====
function VerificationStatusWidget({ totalPhotos, pendingPhotos }: { totalPhotos: number; pendingPhotos: number }) {
  const router = useRouter()
  const verifiedPhotos = totalPhotos - pendingPhotos
  const verificationRate = totalPhotos > 0 ? (verifiedPhotos / totalPhotos) * 100 : 100

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Verification Status
          </CardTitle>
          <CardDescription>Photo verification progress</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push("/verification-center")}>
          Review
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div 
            className="text-center p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => router.push("/verification-center")}
          >
            <p className="text-2xl font-bold">{totalPhotos}</p>
            <p className="text-xs text-muted-foreground">Total Photos</p>
          </div>
          <div 
            className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            onClick={() => router.push("/verification-center?tab=verified")}
          >
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{verifiedPhotos}</p>
            <p className="text-xs text-green-600/70 dark:text-green-400/70">Verified</p>
          </div>
          <div 
            className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            onClick={() => router.push("/verification-center?tab=pending")}
          >
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingPhotos}</p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">Pending</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Verification Rate</span>
            <span className="font-medium">{verificationRate.toFixed(1)}%</span>
          </div>
          <Progress value={verificationRate} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}



