"use client"

import { useState, useEffect } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRightLeft, Clock, CheckCircle, XCircle, AlertCircle, Users, Loader2 } from "lucide-react"
import { format, startOfWeek, addDays, parseISO, startOfDay, endOfDay, differenceInCalendarDays } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface Employee {
  id: number
  firstName: string
  lastName: string
  name?: string
  avatar?: string
  role?: string
  availability?: string | null
}

interface Shift {
  id?: number
  employeeId: number
  day: number
  start: string
  end: string
  type: string
  date?: string
}

interface SwapRequest {
  id: number
  fromEmployeeId: number
  toEmployeeId: number
  requestedByRole?: string
  requestedBy?: Employee | null
  fromEmployee?: Employee | null
  toEmployee?: Employee | null
  fromJob?: Job | null
  toJob?: Job | null
  reason?: string | null
  status: string
  createdAt: string
}

interface Job {
  id: number
  title: string
  status: string
  scheduledFor?: string | null
  scheduledEnd?: string | null
  assignedTo?: number | null
  customer?: { firstName: string; lastName: string } | null
  assignee?: { firstName: string; lastName: string } | null
}

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const availabilityKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
type AvailabilityStatus = "available" | "unavailable" | "am" | "pm"

function getAvailabilityLabel(status: AvailabilityStatus) {
  switch (status) {
    case "available":
      return "Available"
    case "am":
      return "AM only"
    case "pm":
      return "PM only"
    case "unavailable":
      return "Unavailable"
    default:
      return "Available"
  }
}

function getAvailabilityColor(status: AvailabilityStatus) {
  switch (status) {
    case "available":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
    case "am":
    case "pm":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
    case "unavailable":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getJobStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
    case "scheduled":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
    case "in-progress":
    case "in_progress":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
    case "pending":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
    case "rejected":
      return "bg-gray-300 text-gray-800 border-gray-400"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function formatJobStatus(status: string) {
  return status.replace(/_/g, " ")
}

function parseAvailability(raw?: string | null): Record<(typeof availabilityKeys)[number], AvailabilityStatus> {
  const fallback: Record<(typeof availabilityKeys)[number], AvailabilityStatus> = {
    mon: "available",
    tue: "available",
    wed: "available",
    thu: "available",
    fri: "available",
    sat: "available",
    sun: "available",
  }

  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return availabilityKeys.reduce((acc, key) => {
      const value = parsed?.[key]
      acc[key] = value === "unavailable" || value === "am" || value === "pm" ? value : "available"
      return acc
    }, { ...fallback })
  } catch {
    return fallback
  }
}

function getShiftColor(type: string) {
  switch (type) {
    case "early":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
    case "regular":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
    case "late":
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
    case "weekend":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
    default:
      return "bg-muted"
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Pending
        </Badge>
      )
    case "approved":
      return (
        <Badge className="gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" /> Approved
        </Badge>
      )
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      )
    default:
      return null
  }
}

export default function ShiftsPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [swapForm, setSwapForm] = useState({ fromJobId: "", toJobId: "", reason: "" })
  const [swapSaving, setSwapSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [currentWeekDates, setCurrentWeekDates] = useState<string[]>([])
  const [weekLabel, setWeekLabel] = useState("")
  const [jobsDialogOpen, setJobsDialogOpen] = useState(false)
  const [jobsDialogTitle, setJobsDialogTitle] = useState("")
  const [jobsDialogItems, setJobsDialogItems] = useState<Job[]>([])
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [availabilityEmployee, setAvailabilityEmployee] = useState<Employee | null>(null)
  const [availabilityForm, setAvailabilityForm] = useState<Record<(typeof availabilityKeys)[number], AvailabilityStatus>>({
    mon: "available",
    tue: "available",
    wed: "available",
    thu: "available",
    fri: "available",
    sat: "available",
    sun: "available",
  })
  const [availabilitySaving, setAvailabilitySaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const dates = Array.from({ length: 7 }, (_, i) => format(addDays(weekStartDate, i), "d"))
    setCurrentWeekDates(dates)
    setWeekLabel(`${format(weekStartDate, "MMMM d")} - ${format(addDays(weekStartDate, 6), "d, yyyy")}`)
    
    fetchData(weekStartDate)
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [weekStartDate])

  const fetchData = async (weekStart = weekStartDate) => {
    try {
      const weekEnd = addDays(weekStart, 6)
      const [shiftsRes, employeesRes, jobsRes, swapsRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/employees?status=active"),
        fetch(`/api/jobs?startDate=${weekStart.toISOString()}&endDate=${endOfDay(weekEnd).toISOString()}`),
        fetch("/api/shift-swaps"),
      ])

      const shiftsData = shiftsRes.ok ? await shiftsRes.json() : []
      const employeesData = employeesRes.ok ? await employeesRes.json() : []
      const jobsData = jobsRes.ok ? await jobsRes.json() : []
      const swapsData = swapsRes.ok ? await swapsRes.json() : []

      // Format employees
      const formattedEmployees = employeesData.map((emp: any) => ({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`,
        avatar: emp.avatar,
        role: emp.role || "Employee",
        availability: emp.availability,
      }))
      setEmployees(formattedEmployees)

      // Create employee map
      const employeeMap = new Map(formattedEmployees.map((e: Employee) => [e.id, e]))

      // Format shifts - map from API data to day index
      const formattedShifts: Shift[] = shiftsData.map((shift: any) => {
        const shiftDate = shift.date ? parseISO(shift.date) : new Date()
        const dayIndex = Math.max(0, Math.min(6, shiftDate.getDay() === 0 ? 6 : shiftDate.getDay() - 1))
        
        // Determine shift type based on time
        let type = "regular"
        const startHour = parseInt(shift.startTime?.split(":")[0] || "8")
        if (startHour < 7) type = "early"
        else if (startHour >= 12) type = "late"
        else if (dayIndex >= 5) type = "weekend"

        return {
          id: shift.id,
          employeeId: shift.employeeId,
          day: dayIndex,
          start: shift.startTime || "08:00",
          end: shift.endTime || "16:00",
          type,
          date: shift.date,
        }
      })
      setShifts(formattedShifts)

      const allowedStatuses = new Set(["scheduled", "in-progress", "in_progress", "completed"])
      const formattedJobs: Job[] = (jobsData || [])
        .filter((job: any) => allowedStatuses.has(String(job.status || "").toLowerCase()))
        .map((job: any) => ({
          id: job.id,
          title: job.title,
          status: job.status,
          scheduledFor: job.scheduledFor,
          scheduledEnd: job.scheduledEnd,
          assignedTo: job.assignedTo,
          customer: job.customer,
          assignee: job.assignee,
        }))
      setJobs(formattedJobs)

      const formattedSwaps: SwapRequest[] = (swapsData || []).map((swap: any) => ({
        id: swap.id,
        fromEmployeeId: swap.fromEmployeeId,
        toEmployeeId: swap.toEmployeeId,
        requestedByRole: swap.requestedByRole,
        requestedBy: swap.requestedBy,
        fromEmployee: swap.fromEmployee,
        toEmployee: swap.toEmployee,
        fromJob: swap.fromJob,
        toJob: swap.toJob,
        reason: swap.reason,
        status: swap.status || "pending",
        createdAt: swap.createdAt || "",
      }))
      setSwapRequests(formattedSwaps)

    } catch (error) {
      console.error("Failed to fetch shifts data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSwapStatus = async (id: number, status: string) => {
    try {
      const response = await fetch(`/api/shift-swaps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        toast({ title: "Success", description: `Swap request ${status}` })
        fetchData()
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update swap request", variant: "destructive" })
    }
  }

  const formatJobLabel = (job: Job) => {
    const employee = employees.find((emp) => emp.id === job.assignedTo)
    const date = job.scheduledFor ? new Date(job.scheduledFor) : null
    const day = date ? date.toLocaleDateString("en-GB") : "Date TBD"
    const time = date ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Time TBD"
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : "Unassigned"
    return `${employeeName} - ${job.title} (${day} ${time})`
  }

  const handleCreateSwapRequest = async () => {
    const fromJobId = parseInt(swapForm.fromJobId)
    const toJobId = parseInt(swapForm.toJobId)

    if (!fromJobId || !toJobId || fromJobId === toJobId) {
      toast({ title: "Select two different jobs", variant: "destructive" })
      return
    }

    const fromJob = jobs.find((job) => job.id === fromJobId)
    const toJob = jobs.find((job) => job.id === toJobId)

    if (!fromJob || !toJob) {
      toast({ title: "Jobs not found", variant: "destructive" })
      return
    }

    if (!fromJob.assignedTo || !toJob.assignedTo || fromJob.assignedTo === toJob.assignedTo) {
      toast({ title: "Jobs must be assigned to two different employees", variant: "destructive" })
      return
    }

    setSwapSaving(true)
    try {
      const response = await fetch("/api/shift-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromJobId,
          toJobId,
          reason: swapForm.reason,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to create swap request")
      }

      toast({ title: "Swap request sent", description: "Employees will be notified by email." })
      setSwapDialogOpen(false)
      setSwapForm({ fromJobId: "", toJobId: "", reason: "" })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create swap request",
        variant: "destructive",
      })
    } finally {
      setSwapSaving(false)
    }
  }

  // Calculate stats
  const staffOnShiftToday = new Set(shifts.filter(s => s.day === new Date().getDay() - 1).map(s => s.employeeId)).size
  const pendingSwaps = swapRequests.filter(r => r.status === "pending").length
  const approvedSwaps = swapRequests.filter(r => r.status === "approved").length
  const totalHours = shifts.reduce((sum, s) => {
    const [startH] = s.start.split(":").map(Number)
    const [endH] = s.end.split(":").map(Number)
    return sum + (endH - startH)
  }, 0)

  const formatTime = (value?: string | null) => {
    if (!value) return ""
    const date = new Date(value)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  }

  const formatJobSchedule = (job?: Job | null) => {
    if (!job?.scheduledFor) return "Date TBD"
    const date = new Date(job.scheduledFor)
    const day = date.toLocaleDateString("en-GB")
    const start = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    const end = job.scheduledEnd
      ? new Date(job.scheduledEnd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : ""
    return `${day} ${start}${end ? `-${end}` : ""}`
  }

  const getDayIndex = (value?: string | null) => {
    if (!value) return -1
    const date = new Date(value)
    if (isNaN(date.getTime())) return -1
    return differenceInCalendarDays(startOfDay(date), startOfDay(weekStartDate))
  }

  const openJobsDialog = (title: string, items: Job[]) => {
    setJobsDialogTitle(title)
    setJobsDialogItems(items)
    setJobsDialogOpen(true)
  }

  const openAvailabilityDialog = (employee: Employee) => {
    setAvailabilityEmployee(employee)
    setAvailabilityForm(parseAvailability(employee.availability))
    setAvailabilityDialogOpen(true)
  }

  const saveAvailability = async () => {
    if (!availabilityEmployee) return
    setAvailabilitySaving(true)
    try {
      const response = await fetch(`/api/employees/${availabilityEmployee.id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: availabilityForm }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to update availability")
      }

      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === availabilityEmployee.id
            ? { ...emp, availability: JSON.stringify(availabilityForm) }
            : emp
        )
      )
      setAvailabilityDialogOpen(false)
      toast({ title: "Availability saved", description: "Cleaner availability updated." })
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to update availability", variant: "destructive" })
    } finally {
      setAvailabilitySaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeaderClient />
        <main className="flex-1 p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeaderClient />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Shift Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View schedules, swap shifts, and manage availability</p>
          </div>
          <div className="flex gap-2">
          <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Request Swap
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Request Shift Swap</DialogTitle>
                <DialogDescription>Request to swap a shift with a colleague</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job A</label>
                  <Select
                    value={swapForm.fromJobId}
                    onValueChange={(value) => setSwapForm((prev) => ({ ...prev, fromJobId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select first job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs
                        .filter((job) => String(job.status).toLowerCase() === "scheduled")
                        .map((job) => (
                          <SelectItem key={job.id} value={job.id.toString()}>
                            {formatJobLabel(job)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job B</label>
                  <Select
                    value={swapForm.toJobId}
                    onValueChange={(value) => setSwapForm((prev) => ({ ...prev, toJobId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select second job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs
                        .filter((job) => String(job.status).toLowerCase() === "scheduled")
                        .filter((job) => job.id.toString() !== swapForm.fromJobId)
                        .map((job) => (
                          <SelectItem key={job.id} value={job.id.toString()}>
                            {formatJobLabel(job)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason</label>
                  <Textarea
                    placeholder="Reason for the swap request"
                    value={swapForm.reason}
                    onChange={(event) => setSwapForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSwapRequest} disabled={swapSaving}>
                  {swapSaving ? "Sending..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{staffOnShiftToday || employees.length}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Staff on shift today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <ArrowRightLeft className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{pendingSwaps}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Pending swap requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{approvedSwaps}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Swaps approved this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{totalHours}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Total hours this week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 md:w-fit md:inline-flex">
          <TabsTrigger value="schedule" className="px-2 text-xs sm:text-sm">Weekly Schedule</TabsTrigger>
          <TabsTrigger value="swaps" className="px-2 text-xs sm:text-sm">Swap Requests</TabsTrigger>
          <TabsTrigger value="availability" className="px-2 text-xs sm:text-sm">Availability</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Weekly Schedule</CardTitle>
                  <CardDescription>{weekLabel}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeekStartDate(addDays(weekStartDate, -7))}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekStartDate(addDays(weekStartDate, 7))}>
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:hidden">
                {weekDays.map((day, dayIndex) => {
                  const dayJobs = jobs.filter((job) => getDayIndex(job.scheduledFor) === dayIndex)
                  return (
                    <div key={day} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          {day} {currentWeekDates[dayIndex]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {dayJobs.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No jobs</div>
                        ) : (
                          dayJobs.map((job, index) => {
                            const employee = employees.find((e) => e.id === job.assignedTo)
                            const start = formatTime(job.scheduledFor)
                            const end = formatTime(job.scheduledEnd)
                            const timeRange = start ? `${start}${end ? ` - ${end}` : ""}` : "Unscheduled"
                            return (
                              <div
                                key={`${job.id}-${index}`}
                                className={`flex items-center justify-between rounded-md px-2 py-1 text-xs border ${getJobStatusColor(job.status)}`}
                                onClick={() =>
                                  openJobsDialog(`${day} ${currentWeekDates[dayIndex]}`, [job])
                                }
                              >
                                <span className="font-medium">
                                  {employee?.name || `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Cleaner"}
                                </span>
                                <span>
                                  {timeRange}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <div className="min-w-[640px] sm:min-w-[800px]">
                  {/* Header row */}
                  <div className="grid grid-cols-8 gap-2 mb-4">
                    <div className="font-medium text-sm text-muted-foreground">Employee</div>
                    {weekDays.map((day, i) => (
                      <div key={day} className="text-center">
                        <div className="font-medium text-sm">{day}</div>
                        <div className="text-xs text-muted-foreground">{currentWeekDates[i]}</div>
                      </div>
                    ))}
                  </div>
                  {/* Employee rows */}
                  {employees.map((employee) => (
                    <div key={employee.id} className="grid grid-cols-8 gap-2 mb-3 items-center">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {employee.avatar ? <AvatarImage src={employee.avatar} /> : null}
                          <AvatarFallback className="text-xs font-semibold text-muted-foreground">
                            {(employee.name || `${employee.firstName} ${employee.lastName}`)
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:block">
                          <p className="text-sm font-medium truncate max-w-[100px]">{(employee.name || employee.firstName || "").split(" ")[0]}</p>
                        </div>
                      </div>
                      {weekDays.map((_, dayIndex) => {
                        const dayJobs = jobs.filter(
                          (job) => job.assignedTo === employee.id && getDayIndex(job.scheduledFor) === dayIndex
                        )
                        if (dayJobs.length > 0) {
                          const visibleJobs = dayJobs.slice(0, 3)
                          return (
                            <div
                              key={dayIndex}
                              className={`h-24 rounded-lg border p-2 cursor-pointer hover:shadow-sm transition-shadow ${getJobStatusColor(dayJobs[0].status)}`}
                              onClick={() =>
                                openJobsDialog(
                                  `${weekDays[dayIndex]} ${currentWeekDates[dayIndex]} - ${employee.name || employee.firstName}`,
                                  dayJobs
                                )
                              }
                            >
                              <div className="space-y-1">
                                {visibleJobs.map((job) => {
                                  const start = formatTime(job.scheduledFor)
                                  const end = formatTime(job.scheduledEnd)
                                  const timeRange = start ? `${start}${end ? `-${end}` : ""}` : "Unscheduled"
                                  const customerName = job.customer
                                    ? `${job.customer.firstName} ${job.customer.lastName}`
                                    : "Customer"
                                  return (
                                    <div key={job.id} className="text-[10px] leading-tight">
                                      <div className="font-medium truncate">{job.title}</div>
                                      <div className="text-muted-foreground truncate">
                                        {timeRange} • {customerName}
                                      </div>
                                    </div>
                                  )
                                })}
                                {dayJobs.length > visibleJobs.length && (
                                  <div className="text-[10px] text-muted-foreground">
                                    +{dayJobs.length - visibleJobs.length} more
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }

                        return <div key={dayIndex} className="h-24 rounded-lg bg-muted/30" />
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swaps">
          <Card>
            <CardHeader>
              <CardTitle>Shift Swap Requests</CardTitle>
              <CardDescription>Review and manage swap requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {swapRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No swap requests</p>
                ) : (
                  swapRequests.map((request) => {
                    const fromEmployee = request.fromEmployee
                    const toEmployee = request.toEmployee
                    const fromJob = request.fromJob
                    const toJob = request.toJob
                    const requestedByName =
                      request.requestedByRole === "company"
                        ? "Company"
                        : request.requestedBy
                        ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`
                        : "Employee"

                    return (
                    <div key={request.id} className="p-4 rounded-lg border bg-card">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 border-2 border-background">
                              {fromEmployee?.avatar ? <AvatarImage src={fromEmployee.avatar} /> : null}
                              <AvatarFallback>
                                {(fromEmployee?.name || `${fromEmployee?.firstName || ""} ${fromEmployee?.lastName || ""}`)
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="mx-2">
                              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Avatar className="h-10 w-10 border-2 border-background">
                              {toEmployee?.avatar ? <AvatarImage src={toEmployee.avatar} /> : null}
                              <AvatarFallback>
                                {(toEmployee?.name || `${toEmployee?.firstName || ""} ${toEmployee?.lastName || ""}`)
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div>
                            <p className="font-medium">
                              {fromEmployee?.name || `${fromEmployee?.firstName || ""} ${fromEmployee?.lastName || ""}`.trim()}{" "}
                              <span className="text-muted-foreground">swap with</span>{" "}
                              {toEmployee?.name || `${toEmployee?.firstName || ""} ${toEmployee?.lastName || ""}`.trim()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Requested by {requestedByName}</p>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Giving: </span>
                                {fromJob?.title || "Job"} - {formatJobSchedule(fromJob)}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Taking: </span>
                                {toJob?.title || "Job"} - {formatJobSchedule(toJob)}
                              </div>
                            </div>
                            {request.reason ? (
                              <p className="text-sm text-muted-foreground mt-2">Reason: {request.reason}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground mt-1">
                              {request.createdAt ? new Date(request.createdAt).toLocaleString("en-GB") : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          {request.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 bg-transparent"
                                onClick={() => handleUpdateSwapStatus(request.id, "approved")}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 bg-transparent"
                                onClick={() => handleUpdateSwapStatus(request.id, "rejected")}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Employee Availability</CardTitle>
              <CardDescription>View and manage when employees are available to work</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No employees found</p>
                ) : (
                  employees.map((employee) => {
                    const availability = parseAvailability(employee.availability)
                    return (
                      <div key={employee.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={employee.avatar || "/placeholder.svg"} />
                              <AvatarFallback>
                                {(employee.name || `${employee.firstName} ${employee.lastName}`)
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{employee.name || `${employee.firstName} ${employee.lastName}`}</p>
                              <p className="text-sm text-muted-foreground">{employee.role}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openAvailabilityDialog(employee)}>
                            Edit Availability
                          </Button>
                        </div>
                        <div className="mt-4 grid grid-cols-7 gap-2">
                          {weekDays.map((day, i) => {
                            const status = availability[availabilityKeys[i]]
                            return (
                              <div
                                key={day}
                                className={`p-2 rounded text-center text-sm ${getAvailabilityColor(status)}`}
                              >
                                <div className="font-medium">{day}</div>
                                <div className="text-xs">{getAvailabilityLabel(status)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </main>

      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Availability</DialogTitle>
            <DialogDescription>
              {availabilityEmployee ? `${availabilityEmployee.firstName} ${availabilityEmployee.lastName}` : "Cleaner"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {weekDays.map((day, index) => {
              const key = availabilityKeys[index]
              return (
                <div key={day} className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{day}</div>
                  <Select
                    value={availabilityForm[key]}
                    onValueChange={(value) =>
                      setAvailabilityForm((prev) => ({ ...prev, [key]: value as AvailabilityStatus }))
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="am">AM only</SelectItem>
                      <SelectItem value="pm">PM only</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAvailability} disabled={availabilitySaving}>
              {availabilitySaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={jobsDialogOpen} onOpenChange={setJobsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{jobsDialogTitle}</DialogTitle>
            <DialogDescription>Jobs scheduled for this cleaner and day.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {jobsDialogItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs.</p>
            ) : (
              jobsDialogItems.map((job) => {
                const start = formatTime(job.scheduledFor)
                const end = formatTime(job.scheduledEnd)
                const timeRange = start ? `${start}${end ? ` - ${end}` : ""}` : "Unscheduled"
                const customerName = job.customer
                  ? `${job.customer.firstName} ${job.customer.lastName}`
                  : "Customer"
                return (
                  <div key={job.id} className={`rounded-md border p-3 ${getJobStatusColor(job.status)}`}>
                    <div className="font-medium">{job.title}</div>
                    <div className="text-sm text-muted-foreground">{timeRange}</div>
                    <div className="text-sm text-muted-foreground">{customerName}</div>
                    <div className="text-xs text-muted-foreground mt-1">Status: {formatJobStatus(job.status)}</div>
                  </div>
                )
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
