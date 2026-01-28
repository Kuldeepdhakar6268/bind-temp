"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Clock, 
  Loader2,
  RefreshCw,
  Briefcase,
  Camera,
  Target
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns"
import { DateRange } from "react-day-picker"

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
  staffOnDutyToday: number
  pendingTasks: number
  totalHours: number
  hoursChange: number
  previousHours: number
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

const periodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

export function StatsOverviewEnhanced() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [period, setPeriod] = useState<PeriodInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: new Date(),
  })
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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
        setPeriod(data.period)
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedPeriod, dateRange])

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value)
    if (value === "custom") {
      setShowCustomPicker(true)
    } else {
      setShowCustomPicker(false)
    }
  }

  const getPeriodLabel = () => {
    if (!period) return ""
    const start = new Date(period.startDate)
    const end = new Date(period.endDate)
    
    if (selectedPeriod === "today") {
      return format(start, "MMMM d, yyyy")
    }
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-48 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const statItems = [
    {
      title: "Total Revenue",
      value: `£${(stats?.totalRevenue || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: stats?.revenueChange || 0,
      changeLabel: `${(stats?.revenueChange || 0) >= 0 ? "+" : ""}${stats?.revenueChange?.toFixed(1) || 0}%`,
      trend: (stats?.revenueChange || 0) >= 0 ? "up" : "down",
      icon: DollarSign,
      description: getPeriodLabel(),
      subText: stats?.previousRevenue ? `vs £${stats.previousRevenue.toLocaleString()} prev` : null,
      color: "bg-emerald-100 text-emerald-600",
      link: "/invoices",
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
      color: "bg-blue-100 text-blue-600",
      link: "/scheduling",
    },
    {
      title: "Staff On Duty",
      value: String(stats?.staffOnDutyToday || 0),
      change: 0,
      changeLabel: getPeriodLabel(),
      trend: "up",
      icon: Users,
      description: `${stats?.activeEmployees || 0} active employees`,
      subText: null,
      color: "bg-violet-100 text-violet-600",
      link: "/employees",
    },
    {
      title: "Completion Rate",
      value: `${(stats?.completionRate || 0).toFixed(1)}%`,
      change: stats?.completionRateChange || 0,
      changeLabel: (stats?.completionRate || 0) >= 80 ? "Good" : "Needs attention",
      trend: (stats?.completionRate || 0) >= 80 ? "up" : "down",
      icon: Target,
      description: getPeriodLabel(),
      subText: stats?.completionRateAllTime !== undefined
        ? `All-time ${stats.completionRateAllTime.toFixed(1)}%`
        : null,
      color: "bg-teal-100 text-teal-600",
      link: "/verification-center",
    },
    {
      title: "Pending Tasks",
      value: String(stats?.pendingTasks || 0),
      change: stats?.scheduledJobs || 0,
      changeLabel: `${stats?.scheduledJobs || 0} jobs scheduled`,
      trend: (stats?.pendingTasks || 0) < 10 ? "down" : "up",
      icon: AlertCircle,
      description: getPeriodLabel(),
      subText: stats?.pendingPhotos ? `${stats.pendingPhotos} photos to verify` : null,
      color: "bg-amber-100 text-amber-600",
      link: "/scheduling",
    },
    {
      title: "Total Hours",
      value: (stats?.totalHours || 0).toLocaleString(),
      change: stats?.hoursChange || 0,
      changeLabel: `${(stats?.hoursChange || 0) >= 0 ? "+" : ""}${stats?.hoursChange?.toFixed(1) || 0}%`,
      trend: (stats?.hoursChange || 0) >= 0 ? "up" : "down",
      icon: Clock,
      description: getPeriodLabel(),
      subText: stats?.previousHours ? `vs ${stats.previousHours}h prev` : null,
      color: "bg-rose-100 text-rose-600",
      link: "/check-in",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-44">
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
            <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range)
                    if (range?.from && range?.to) {
                      setShowCustomPicker(false)
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          {period && (
            <Badge variant="outline" className="text-muted-foreground">
              {getPeriodLabel()}
            </Badge>
          )}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchStats}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statItems.map((stat) => {
          const Icon = stat.icon
          const isPositive = stat.trend === "up" && !stat.title.includes("Pending")
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown

          return (
            <Card 
              key={stat.title} 
              className="p-5 hover:shadow-lg transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary"
              onClick={() => window.location.href = stat.link}
            >
              <div className="flex items-start justify-between">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", stat.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                    isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {stat.changeLabel}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <h3 className="text-2xl font-bold mt-1 group-hover:text-primary transition-colors">{stat.value}</h3>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                {stat.subText && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{stat.subText}</p>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Camera className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium">Photos This Period</p>
              <p className="text-lg font-bold text-blue-700">{stats?.totalPhotos || 0}</p>
            </div>
            {(stats?.pendingPhotos || 0) > 0 && (
              <Badge className="ml-auto bg-amber-500">{stats?.pendingPhotos} pending</Badge>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium">Jobs Completed</p>
              <p className="text-lg font-bold text-green-700">{stats?.completedJobs || 0}</p>
            </div>
            {(stats?.completedJobsChange || 0) !== 0 && (
              <Badge variant="outline" className={cn(
                "ml-auto",
                (stats?.completedJobsChange || 0) > 0 ? "text-green-600 border-green-300" : "text-red-600 border-red-300"
              )}>
                {(stats?.completedJobsChange || 0) > 0 ? "+" : ""}{stats?.completedJobsChange} vs prev
              </Badge>
            )}
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-violet-600 font-medium">Active Employees</p>
              <p className="text-lg font-bold text-violet-700">{stats?.activeEmployees || 0}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-violet-600 border-violet-300">
              {stats?.staffOnDutyToday || 0} on duty
            </Badge>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-amber-600 font-medium">Scheduled Jobs</p>
              <p className="text-lg font-bold text-amber-700">{stats?.scheduledJobs || 0}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-amber-600 border-amber-300">
              {stats?.periodJobs || 0} in period
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  )
}
