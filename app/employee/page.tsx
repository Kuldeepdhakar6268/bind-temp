"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Clock, Briefcase, Calendar, CheckCircle, AlertCircle, Eye, Loader2, ArrowRight, Wallet, RefreshCw, Wifi, WifiOff, Play, User, MapPin, PoundSterling } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from "date-fns"
import Link from "next/link"
import { useEmployeeSessionTimeout } from "@/hooks/use-session-timeout"

type Job = {
  id: number
  title: string
  jobType?: string | null
  customer: { name: string } | null
  scheduledFor: Date | string | null
  scheduledEnd: Date | string | null
  status: string
  location: string | null
  city: string | null
  postcode: string | null
  employeeAccepted?: number | null
  durationMinutes?: number | null
  planEstimatedDuration?: string | null
  planPrice?: string | null
  employeePay?: string | null
  employeePayType?: string | null
  tasksTotal?: number | null
  tasksCompleted?: number | null
}

const UPCOMING_MONTHS = 1

export default function EmployeeDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [todayJobs, setTodayJobs] = useState<Job[]>([])
  const [pendingConfirmationJobs, setPendingConfirmationJobs] = useState<Job[]>([])
  const [updatingJob, setUpdatingJob] = useState<number | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "custom">("today")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [stats, setStats] = useState({
    todayJobs: 0,
    completedToday: 0,
    hoursToday: 0,
    locations: 0,
  })
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null)
  const [pendingJobId, setPendingJobId] = useState<number | null>(null)
  const [checkoutComment, setCheckoutComment] = useState("")
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [selectedDayJobs, setSelectedDayJobs] = useState<Job[]>([])

  const parseEstimatedMinutes = (value?: string | null) => {
    if (!value) return null
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) return null
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const minutes = Number(trimmed)
      return Number.isFinite(minutes) && minutes > 0 ? minutes : null
    }
    const hoursMatch = trimmed.match(/(\d+(\.\d+)?)\s*(h|hour|hours)/)
    const minutesMatch = trimmed.match(/(\d+(\.\d+)?)\s*(m|min|mins|minute|minutes)/)
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0
    const total = (Number.isFinite(hours) ? hours * 60 : 0) + (Number.isFinite(minutes) ? minutes : 0)
    return total > 0 ? total : null
  }

  // Session timeout - auto logout after 60 minutes of inactivity
  useEmployeeSessionTimeout((minutes) => {
    toast.warning(`Session expires in ${minutes} minutes`, {
      description: "Move your mouse or tap the screen to stay logged in.",
      duration: 30000,
    })
  })

  const loadDashboardData = useCallback(async (showLoading = false) => {
    if (!isAuthorized) return
    if (showLoading) setLoading(true)
    try {
      // Load jobs for selected period and all pending confirmations
      if (timeFilter === "custom" && (!customStartDate || !customEndDate)) {
        return
      }
      const jobParams = new URLSearchParams({ filter: timeFilter })
      if (timeFilter === "custom") {
        jobParams.set("start", customStartDate)
        jobParams.set("end", customEndDate)
      }
      const [jobsRes, allJobsRes] = await Promise.all([
        fetch(`/api/employee/jobs?${jobParams.toString()}`),
        fetch("/api/employee/jobs?filter=all"),
      ])
      const jobsJson = await jobsRes.json()
      const jobsData: Job[] = Array.isArray(jobsJson) ? jobsJson : []
      const allJobsJson = allJobsRes.ok ? await allJobsRes.json() : []
      const allJobsData: Job[] = Array.isArray(allJobsJson) ? allJobsJson : []

      // Check for new jobs
      if (todayJobs.length > 0 && jobsData.length > todayJobs.length) {
        const newCount = jobsData.length - todayJobs.length
        toast.info(`${newCount} new job${newCount > 1 ? 's' : ''} assigned!`, {
          icon: <Briefcase className="h-4 w-4" />,
        })
      }

      setTodayJobs(jobsData)
      const pendingJobs = allJobsData
        .filter((job) => job.status === "scheduled" && !job.employeeAccepted)
        .sort((a, b) => {
          const aTime = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0
          const bTime = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0
          return aTime - bTime
        })
      setPendingConfirmationJobs(pendingJobs)
      setLastUpdated(new Date())

      // Calculate stats
      const completed = jobsData.filter((j: Job) => j.status === "completed").length
      const totalMinutes = jobsData.reduce((sum, job) => {
        const planMinutes = parseEstimatedMinutes(job.planEstimatedDuration)
        if (planMinutes) {
          return sum + planMinutes
        }
        if (job.scheduledFor && job.scheduledEnd) {
          const start = new Date(job.scheduledFor).getTime()
          const end = new Date(job.scheduledEnd).getTime()
          if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
            return sum + (end - start) / 60000
          }
        }
        return sum + (typeof job.durationMinutes === "number" ? job.durationMinutes : 0)
      }, 0)
      const uniqueLocations = new Set(
        jobsData.map((job) => {
          const locationParts = [job.location, job.city, job.postcode].filter(Boolean)
          return locationParts.join(", ").trim()
        }).filter(Boolean)
      )
      setStats({
        todayJobs: jobsData.length,
        completedToday: completed,
        hoursToday: totalMinutes / 60,
        locations: uniqueLocations.size,
      })
    } catch (error) {
      console.error("Error loading dashboard:", error)
    } finally {
      setLoading(false)
    }
  }, [isAuthorized, timeFilter, customStartDate, customEndDate, todayJobs.length])

  // Check employee session before loading data
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/employee-session")
        if (!res.ok) {
          router.push("/login")
          return
        }
        const data = await res.json()
        if (!data?.id && !data?.employeeId && !data?.username) {
          router.push("/login")
          return
        }
        setIsAuthorized(true)
      } catch {
        router.push("/login")
      } finally {
        setSessionReady(true)
      }
    }

    checkSession()
  }, [router])

  // Initial load after auth check
  useEffect(() => {
    if (isAuthorized) {
      loadDashboardData(true)
    }
  }, [isAuthorized, timeFilter, customStartDate, customEndDate, loadDashboardData])

  // Polling for new jobs every 5 seconds
  useEffect(() => {
    if (!isAuthorized) return
    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        loadDashboardData(false)
      }, 5000) // Poll every 5 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [isPolling, isAuthorized, loadDashboardData])

  // Pause polling when updating a job
  useEffect(() => {
    if (updatingJob !== null) {
      setIsPolling(false)
    } else {
      setIsPolling(true)
    }
  }, [updatingJob])

  const upcomingMonthsLabel = UPCOMING_MONTHS === 1 ? "This Month" : `Next ${UPCOMING_MONTHS} Months`
  const upcomingMonthsLower = UPCOMING_MONTHS === 1 ? "this month" : `next ${UPCOMING_MONTHS} months`
  const customRangeLabel = customStartDate && customEndDate
    ? `${format(new Date(customStartDate), "MMM d, yyyy")} - ${format(new Date(customEndDate), "MMM d, yyyy")}`
    : "Custom Range"
  const periodLabel = timeFilter === "today"
    ? "Today"
    : timeFilter === "week"
      ? "This Week"
      : timeFilter === "custom"
        ? customRangeLabel
        : upcomingMonthsLabel
  const periodLower = timeFilter === "today"
    ? "today"
    : timeFilter === "week"
      ? "this week"
      : timeFilter === "custom"
        ? "selected range"
        : upcomingMonthsLower
  const monthRangeStart = startOfMonth(new Date())
  const monthRangeEnd = endOfMonth(addMonths(monthRangeStart, UPCOMING_MONTHS - 1))
  const customRangeStart = customStartDate ? new Date(customStartDate) : null
  const customRangeEnd = customEndDate ? new Date(customEndDate) : null
  const hasCustomRange = Boolean(
    customRangeStart &&
    customRangeEnd &&
    !Number.isNaN(customRangeStart.getTime()) &&
    !Number.isNaN(customRangeEnd.getTime())
  )
  const monthRangeLabel = UPCOMING_MONTHS === 1
    ? format(monthRangeStart, "MMMM yyyy")
    : `${format(monthRangeStart, "MMM yyyy")} - ${format(monthRangeEnd, "MMM yyyy")}`
  const calendarLabel = timeFilter === "week"
    ? `Week of ${format(startOfWeek(new Date()), "MMM d, yyyy")}`
    : timeFilter === "custom"
      ? customRangeLabel
      : monthRangeLabel
  const pendingAcceptanceCount = todayJobs.filter(
    (job) => job.status === "scheduled" && !job.employeeAccepted
  ).length
  const pendingAllCount = pendingConfirmationJobs.length

  const formatCurrency = (amount?: string | number | null) => {
    const value = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0)
    if (!Number.isFinite(value) || value <= 0) return null
    return value.toFixed(2)
  }

  const calendarDays = timeFilter === "week"
    ? eachDayOfInterval({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) })
    : timeFilter === "custom" && hasCustomRange
      ? eachDayOfInterval({
          start: startOfWeek(customRangeStart as Date),
          end: endOfWeek(customRangeEnd as Date),
        })
      : eachDayOfInterval({ start: startOfWeek(monthRangeStart), end: endOfWeek(monthRangeEnd) })

  const jobsByDate = calendarDays.reduce<Record<string, Job[]>>((acc, day) => {
    const key = format(day, "yyyy-MM-dd")
    acc[key] = todayJobs.filter((job) => job.scheduledFor && format(new Date(job.scheduledFor), "yyyy-MM-dd") === key)
    return acc
  }, {})

  const openDayDialog = (day: Date, dayJobs: Job[]) => {
    if (dayJobs.length === 0) return
    setSelectedDay(day)
    setSelectedDayJobs(dayJobs)
    setDayDialogOpen(true)
  }

  const buildJobAddress = (job: Job) => {
    const normalizeAddressPart = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, "")
    const locationBase = job.location || ""
    const normalizedLocation = normalizeAddressPart(locationBase)
    const addressParts = [job.location].filter(Boolean) as string[]
    if (job.city && !normalizedLocation.includes(normalizeAddressPart(job.city))) {
      addressParts.push(job.city)
    }
    if (job.postcode && !normalizedLocation.includes(normalizeAddressPart(job.postcode))) {
      addressParts.push(job.postcode)
    }
    return addressParts.join(", ")
  }

  const getJobTone = (job: Job) => {
    if (job.status === "completed") return "bg-green-50 border-green-200"
    if (job.status === "in_progress") return "bg-blue-50 border-blue-200"
    if (job.status === "scheduled" && !job.employeeAccepted) return "bg-red-50 border-red-200"
    return "bg-muted/40"
  }

  const getStatusBadge = (job: Job) => {
    if (job.status === "completed") return "bg-green-600 text-white"
    if (job.status === "in_progress") return "bg-blue-600 text-white"
    if (job.status === "scheduled" && !job.employeeAccepted) return "bg-red-600 text-white"
    return "bg-muted text-foreground"
  }

  const requestCheckAction = (jobId: number, action: "start" | "complete") => {
    setPendingJobId(jobId)
    if (action !== "start") {
      setCheckoutComment("")
    }
    setPendingAction(action === "start" ? "check_in" : "check_out")
    setConfirmDialogOpen(true)
  }

  const confirmCheckAction = async () => {
    if (!pendingJobId || !pendingAction) return
    setUpdatingJob(pendingJobId)
    try {
      const res = await fetch(`/api/employee/jobs/${pendingJobId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pendingAction,
          comment: pendingAction === "check_out" ? checkoutComment.trim() : null,
        }),
      })

      if (res.ok) {
        toast.success(pendingAction === "check_in" ? "Checked in successfully!" : "Checked out successfully!")
        
        // After successful check-in, start the job
        if (pendingAction === "check_in") {
          try {
            await fetch(`/api/employee/jobs/${pendingJobId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "start" }),
            })
            toast.success("Job started!")
          } catch (e) {
            console.error("Failed to start job after check-in:", e)
          }
        }
        
        // After successful check-out, complete the job
        if (pendingAction === "check_out") {
          try {
            await fetch(`/api/employee/jobs/${pendingJobId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "complete" }),
            })
            toast.success("Job completed!")
          } catch (e) {
            console.error("Failed to complete job after check-out:", e)
          }
        }
        if (pendingAction === "check_out") {
          setCheckoutComment("")
        }
        
        loadDashboardData()
      } else {
        const errorData = await res.json().catch(() => null)
        toast.error(errorData?.error || "Failed to update job")
      }
    } catch (error) {
      console.error("Error updating job:", error)
      toast.error("Failed to update job")
    } finally {
      setUpdatingJob(null)
      setConfirmDialogOpen(false)
      setPendingAction(null)
      setPendingJobId(null)
    }
  }

  const handleAcceptJob = async (jobId: number) => {
    setUpdatingJob(jobId)
    try {
      const res = await fetch(`/api/employee/jobs/${jobId}/accept`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to accept job")
      }
      toast.success("Job accepted.")
      loadDashboardData()
    } catch (error) {
      console.error("Error accepting job:", error)
      toast.error(error instanceof Error ? error.message : "Failed to accept job")
    } finally {
      setUpdatingJob(null)
    }
  }

  const handleDeclineJob = async (jobId: number) => {
    if (!confirm("Decline this job assignment?")) return
    setUpdatingJob(jobId)
    try {
      const res = await fetch(`/api/employee/jobs/${jobId}/accept`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Failed to decline job")
      }
      toast.success("Job declined.")
      loadDashboardData()
    } catch (error) {
      console.error("Error declining job:", error)
      toast.error(error instanceof Error ? error.message : "Failed to decline job")
    } finally {
      setUpdatingJob(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-xl max-h-[70vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Selected day"}
            </DialogTitle>
            <DialogDescription>
              {selectedDayJobs.length} job{selectedDayJobs.length === 1 ? "" : "s"} scheduled
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-2">
            {selectedDayJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => router.push(`/employee/jobs/${job.id}`)}
                className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${getJobTone(job)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "--:--"} {job.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {job.customer?.name || "Unknown Customer"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusBadge(job)}`}>
                    {job.status === "scheduled" && !job.employeeAccepted
                      ? "pending approval"
                      : job.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "check_in" ? "Confirm Check In" : "Confirm Check Out"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {pendingAction === "check_in" ? (
                  <p>You are about to check in to this job site. This action is irreversible and your time/location will be recorded.</p>
                ) : (
                  <>
                    <p>You are about to check out from this job site. This action is irreversible and your time/location will be recorded.</p>
                    <div className="pt-2 space-y-2">
                      <Label htmlFor="checkoutComment" className="text-sm text-foreground">Comment (optional)</Label>
                      <Textarea
                        id="checkoutComment"
                        value={checkoutComment}
                        onChange={(e) => setCheckoutComment(e.target.value)}
                        placeholder="Add a note about anything that needs fixing or went wrong..."
                        className="min-h-[90px] text-sm text-foreground"
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground">This note will be shared with your manager.</p>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingAction(null)
                setPendingJobId(null)
                setCheckoutComment("")
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmCheckAction}>
              {pendingAction === "check_in" ? "Yes, Check In" : "Yes, Check Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">My Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Welcome back! Here&apos;s your day at a glance.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={timeFilter === "today" ? "default" : "outline"}
              onClick={() => setTimeFilter("today")}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={timeFilter === "week" ? "default" : "outline"}
              onClick={() => setTimeFilter("week")}
            >
              This Week
            </Button>
            <Button
              size="sm"
              variant={timeFilter === "month" ? "default" : "outline"}
              onClick={() => setTimeFilter("month")}
            >
              {upcomingMonthsLabel}
            </Button>
            <Button
              size="sm"
              variant={timeFilter === "custom" ? "default" : "outline"}
              onClick={() => {
                if (!customStartDate || !customEndDate) {
                  const today = format(new Date(), "yyyy-MM-dd")
                  setCustomStartDate(today)
                  setCustomEndDate(today)
                }
                setTimeFilter("custom")
              }}
            >
              Custom Range
            </Button>
          </div>
          {timeFilter === "custom" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Start date</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">End date</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="h-8"
                />
              </div>
            </div>
          )}
          {/* Live indicator */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            {isPolling ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Paused</span>
              </>
            )}
            <span className="text-[11px] sm:text-xs">
              Updated {format(lastUpdated, "HH:mm:ss")}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => loadDashboardData(true)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">{periodLabel} Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold">{stats.todayJobs}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              {stats.completedToday} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Hours {periodLabel}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold">{stats.hoursToday.toFixed(1)}h</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">{periodLabel} total</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => router.push("/employee/finances")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">My Finances</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/employee/finances">
                View Earnings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0 sm:pt-2">
            <div className="text-lg sm:text-2xl font-bold">{stats.locations}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">{periodLabel} total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Jobs Awaiting Confirmation
              <Badge variant="outline">{pendingAllCount} pending</Badge>
            </CardTitle>
            <CardDescription>All assignments that need your confirmation (any date)</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {pendingConfirmationJobs.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No jobs waiting for your confirmation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingConfirmationJobs.map((job) => {
                const address = buildJobAddress(job)
                const showPayDetails = job.employeePayType !== "salary"
                return (
                  <Card
                    key={job.id}
                    className={`hover:border-primary/50 transition-colors ${getJobTone(job)}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            {job.title}
                            {job.jobType ? <span className="text-sm"> Â· {job.jobType}</span> : null}
                          </CardTitle>
                          <div className="mt-2 space-y-1 text-sm text-foreground">
                            <div className="flex items-start gap-2">
                              <User className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>{job.customer?.name || "Unknown Customer"}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-foreground" />
                              {address ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {address}
                                </a>
                              ) : (
                                <span>No address</span>
                              )}
                            </div>
                            <div className="flex items-start gap-2">
                              <Calendar className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>{job.scheduledFor ? format(new Date(job.scheduledFor), "PPP") : "Date TBD"}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Clock className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>
                                {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "Time TBD"}
                                {job.scheduledEnd && ` - ${format(new Date(job.scheduledEnd), "HH:mm")}`}
                              </span>
                            </div>
                            {showPayDetails && (
                              <div className="flex items-start gap-2">
                                <PoundSterling className="mt-0.5 h-4 w-4 text-foreground" />
                                <span>
                                  {formatCurrency(job.employeePay)
                                    ? `£${formatCurrency(job.employeePay)}`
                                    : "Pay not set"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge className={getStatusBadge(job)}>
                          {job.status === "scheduled" && !job.employeeAccepted
                            ? "pending approval"
                            : job.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleAcceptJob(job.id)}
                          disabled={updatingJob === job.id}
                        >
                          {updatingJob === job.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeclineJob(job.id)}
                          disabled={updatingJob === job.id}
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/employee/jobs/${job.id}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Jobs */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {periodLabel} Schedule
              <Badge variant="outline">{pendingAcceptanceCount} pending</Badge>
            </CardTitle>
            <CardDescription>Your assigned jobs for {periodLower}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {todayJobs.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No jobs scheduled for {periodLower}</p>
              {timeFilter === "today" && (
                <Button variant="outline" className="mt-4" onClick={() => setTimeFilter("week")}>
                  View This Week&apos;s Jobs
                </Button>
              )}
            </div>
          ) : timeFilter === "today" ? (
            <div className="space-y-4">
              {todayJobs.map((job) => {
                const isAccepted = Boolean(job.employeeAccepted)
                const showPayDetails = job.employeePayType !== "salary"
                const address = buildJobAddress(job)
                return (
                  <Card
                    key={job.id}
                    className={`hover:border-primary/50 transition-colors ${
                      job.status === "completed" ? "bg-green-50 border-green-200" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>
                            {job.title}
                            {job.jobType ? <span className="text-sm"> · {job.jobType}</span> : null}
                          </CardTitle>
                          <div className="mt-2 space-y-1 text-sm text-foreground">
                            <div className="flex items-start gap-2">
                              <User className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>{job.customer?.name || "Unknown Customer"}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-foreground" />
                              {address ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {address}
                                </a>
                              ) : (
                                <span>No address</span>
                              )}
                            </div>
                            <div className="flex items-start gap-2">
                              <Calendar className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>{job.scheduledFor ? format(new Date(job.scheduledFor), "PPP") : "Date TBD"}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <Clock className="mt-0.5 h-4 w-4 text-foreground" />
                              <span>
                                {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "Time TBD"}
                                {job.scheduledEnd && ` - ${format(new Date(job.scheduledEnd), "HH:mm")}`}
                              </span>
                            </div>
                            {showPayDetails && (
                              <div className="flex items-start gap-2">
                                <PoundSterling className="mt-0.5 h-4 w-4 text-foreground" />
                                <span>
                                  {formatCurrency(job.employeePay)
                                    ? `£${formatCurrency(job.employeePay)}`
                                    : "Pay not set"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={job.status === "completed" ? "default" : job.status === "in_progress" ? "secondary" : "outline"}
                          className={job.status === "completed" ? "bg-green-600" : job.status === "in_progress" ? "bg-blue-600" : ""}
                        >
                          {job.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {!isAccepted && job.status === "scheduled" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleAcceptJob(job.id)}
                              disabled={updatingJob === job.id}
                            >
                              {updatingJob === job.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeclineJob(job.id)}
                              disabled={updatingJob === job.id}
                            >
                              <AlertCircle className="mr-2 h-4 w-4" />
                              Decline
                            </Button>
                          </>
                        )}
                        {job.status === "scheduled" && isAccepted && (
                          <Button 
                            size="sm"
                            onClick={() => requestCheckAction(job.id, "start")}
                            disabled={updatingJob === job.id}
                          >
                            {updatingJob === job.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="mr-2 h-4 w-4" />
                            )}
                            Start Job
                          </Button>
                        )}
                        {job.status === "in_progress" && (
                          <Button 
                            size="sm"
                            onClick={() => requestCheckAction(job.id, "complete")}
                            disabled={
                              updatingJob === job.id ||
                              (typeof job.tasksTotal === "number" &&
                                job.tasksTotal > 0 &&
                                (job.tasksCompleted || 0) < job.tasksTotal)
                            }
                          >
                            {updatingJob === job.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="mr-2 h-4 w-4" />
                            )}
                            Complete Job
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => router.push(`/employee/jobs/${job.id}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{calendarLabel}</p>
                <p className="text-xs text-muted-foreground">{periodLabel} jobs</p>
              </div>
              {/* Mobile: week list / month list */}
              <div className="sm:hidden space-y-3">
                {timeFilter === "week" ? (
                  <div className="space-y-2">
                    {calendarDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd")
                      const dayJobs = jobsByDate[key] || []
                      if (dayJobs.length === 0) return null
                      return (
                        <div key={key} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {format(day, "EEE")} {format(day, "d")}
                            </span>
                            <button
                              type="button"
                              onClick={() => openDayDialog(day, dayJobs)}
                              className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              {dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}
                            </button>
                          </div>
                          <div className="mt-2 space-y-1">
                            {dayJobs.map((job) => (
                              <button
                                key={job.id}
                                onClick={() => router.push(`/employee/jobs/${job.id}`)}
                                className={`w-full rounded-md border px-2 py-1 text-left text-[12px] ${getJobTone(job)}`}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate">
                                    {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "--:--"} {job.title}
                                  </span>
                                  {!job.employeeAccepted && job.status === "scheduled" && (
                                    <span className="flex items-center gap-1">
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleAcceptJob(job.id)
                                        }}
                                        className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-50 border-green-200"
                                      >
                                        Accept
                                      </span>
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeclineJob(job.id)
                                        }}
                                        className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 border-red-200"
                                      >
                                        Decline
                                      </span>
                                    </span>
                                  )}
                                </span>
                                <span className="truncate block text-[11px] text-muted-foreground">
                                  {job.customer?.name || "Unknown Customer"}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {calendarDays
                      .filter((day) => (jobsByDate[format(day, "yyyy-MM-dd")] || []).length > 0)
                      .map((day) => {
                        const key = format(day, "yyyy-MM-dd")
                        const dayJobs = jobsByDate[key] || []
                        return (
                          <div key={key} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span>{format(day, "EEE, MMM d")}</span>
                              <button
                                type="button"
                                onClick={() => openDayDialog(day, dayJobs)}
                                className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-foreground"
                              >
                                {dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}
                              </button>
                            </div>
                            <div className="mt-2 space-y-1">
                              {dayJobs.map((job) => (
                              <button
                                key={job.id}
                                onClick={() => router.push(`/employee/jobs/${job.id}`)}
                                className={`w-full rounded-md border px-2 py-1 text-left text-[12px] ${getJobTone(job)}`}
                              >
                                <span className="truncate block">
                                  {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "--:--"} {job.title}
                                </span>
                                <span className="truncate block text-[11px] text-muted-foreground">
                                  {job.customer?.name || "Unknown Customer"}
                                </span>
                              </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
              {/* Desktop grid */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center font-medium">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const key = format(day, "yyyy-MM-dd")
                    const dayJobs = jobsByDate[key] || []
                    const inMonth = timeFilter === "week" || (day >= monthRangeStart && day <= monthRangeEnd)
                    return (
                      <div
                        key={key}
                        className={`min-h-[90px] rounded-lg border p-2 ${
                          inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => openDayDialog(day, dayJobs)}
                            disabled={dayJobs.length === 0}
                            className={`text-xs font-semibold ${
                              dayJobs.length > 0 ? "cursor-pointer hover:underline" : "cursor-default"
                            }`}
                          >
                            {format(day, "d")}
                          </button>
                          {dayJobs.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openDayDialog(day, dayJobs)}
                              className="rounded-full border px-2 py-0.5 text-[10px] text-foreground"
                            >
                              {dayJobs.length}
                            </button>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayJobs.slice(0, 3).map((job) => (
                          <button
                            key={job.id}
                            onClick={() => router.push(`/employee/jobs/${job.id}`)}
                            className={`w-full rounded-md border px-1.5 py-1 text-left text-[11px] ${getJobTone(job)}`}
                          >
                              <div className="truncate">
                                {job.scheduledFor ? format(new Date(job.scheduledFor), "HH:mm") : "--:--"} {job.title}
                              </div>
                            </button>
                          ))}
                          {dayJobs.length > 3 && (
                            <div className="text-[10px] text-muted-foreground">
                              +{dayJobs.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
