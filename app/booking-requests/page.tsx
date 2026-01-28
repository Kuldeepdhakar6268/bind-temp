"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { 
  Calendar, Clock, Home, User, Mail, Phone, MapPin,
  Eye, CheckCircle, XCircle, ArrowRight, Loader2,
  Sparkles, FileText, AlertCircle, RefreshCw, Wifi, WifiOff, AlertTriangle, UserPlus, Trash2
} from "lucide-react"

interface BookingRequest {
  id: number
  customerId: number | null
  customerFirstName: string
  customerLastName: string
  customerEmail: string
  customerPhone: string | null
  address: string
  addressLine2: string | null
  city: string | null
  postcode: string | null
  accessInstructions: string | null
  serviceType: string
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFootage: number | null
  hasSpecialRequirements: number
  specialRequirements: string | null
  preferredDate: string | null
  preferredTimeSlot: string | null
  alternateDate: string | null
  frequency: string
  estimatedPrice: string | null
  quotedPrice: string | null
  status: string
  priority: string
  adminNotes: string | null
  convertedToJobId: number | null
  createdAt: string
  existingCustomer: {
    id: number
    firstName: string
    lastName: string
    email: string
  } | null
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  status: string
  hourlyRate?: string | null
}

interface CleaningPlan {
  id: number
  name: string
  category: string | null
  estimatedDuration: string | null
  price?: string | null
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  reviewed: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  converted: "bg-green-600 text-white",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  regular: "Regular Cleaning",
  deep_clean: "Deep Cleaning",
  move_in: "Move-In Cleaning",
  move_out: "Move-Out Cleaning",
  one_time: "One-Time Cleaning",
  spring_clean: "Spring Cleaning",
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "Morning (8am - 12pm)",
  afternoon: "Afternoon (12pm - 5pm)",
  evening: "Evening (5pm - 8pm)",
  flexible: "Flexible",
}

const padTime = (value: number) => value.toString().padStart(2, "0")

const toLocalDateTimeInput = (date: Date) => {
  const year = date.getFullYear()
  const month = padTime(date.getMonth() + 1)
  const day = padTime(date.getDate())
  const hours = padTime(date.getHours())
  const minutes = padTime(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Component to show jobs that need reassignment (declined or unassigned)
function NeedsReassignmentSection({ employees }: { employees: Employee[] }) {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<any | null>(null)

  const fetchUnassignedJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/jobs?status=pending")
      if (response.ok) {
        const data = await response.json()
        const unassigned = data.filter((job: any) => !job.assignedTo)
        setJobs(unassigned)
      }
    } catch (error) {
      console.error("Failed to fetch unassigned jobs:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUnassignedJobs()
    const interval = setInterval(fetchUnassignedJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchUnassignedJobs])

  useEffect(() => {
    const handleJobsUpdated = () => fetchUnassignedJobs()
    window.addEventListener("jobs:updated", handleJobsUpdated)
    return () => window.removeEventListener("jobs:updated", handleJobsUpdated)
  }, [fetchUnassignedJobs])

  const openAssignDialog = (job: any) => {
    setSelectedJob(job)
    setSelectedEmployee("")
    setAssignDialogOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedJob || !selectedEmployee) return

    setAssigning(true)
    try {
      const response = await fetch(`/api/jobs/${selectedJob.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          employeeId: parseInt(selectedEmployee),
          sendNotification: true
        }),
      })

      if (!response.ok) throw new Error("Failed to assign")

      toast.success("Job assigned successfully!")
      setAssignDialogOpen(false)
      fetchUnassignedJobs()
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } catch (error) {
      toast.error("Failed to assign job")
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = async () => {
    if (!jobToDelete) return
    try {
      const response = await fetch(`/api/jobs/${jobToDelete.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete job")
      }
      toast.success("Job deleted")
      setDeleteDialogOpen(false)
      setJobToDelete(null)
      fetchUnassignedJobs()
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job")
    }
  }

  const openDeleteDialog = (job: any) => {
    setJobToDelete(job)
    setDeleteDialogOpen(true)
  }

  const wasDeclined = (job: any) => job.internalNotes?.includes("[Job Declined by Employee")

  if (!loading && jobs.length === 0) return null

  return (
    <>
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-lg text-orange-800 dark:text-orange-200">
                  Jobs Needing Reassignment
                </CardTitle>
                <CardDescription className="text-orange-600 dark:text-orange-400">
                  {loading ? "Loading..." : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} with no cleaner assigned`}
                </CardDescription>
              </div>
            </div>
            <Badge variant="destructive" className="bg-orange-600">
              {jobs.length}
            </Badge>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
              </div>
            ) : (
              jobs.map((job) => {
                const customerName = job.customer
                  ? `${job.customer.firstName} ${job.customer.lastName}`
                  : "Unknown Customer"
                const declined = wasDeclined(job)

                return (
                  <div key={job.id} className="p-3 bg-white dark:bg-gray-900 border rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{job.title}</h4>
                          {declined && (
                            <Badge variant="destructive" className="text-xs">Declined</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {customerName}
                          </span>
                          {job.scheduledFor && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(job.scheduledFor), "MMM d, HH:mm")}
                            </span>
                          )}
                        </div>
                        {declined && job.internalNotes && (
                          <p className="text-xs text-red-600 mt-1">
                            {job.internalNotes.split("\n").find((line: string) => line.startsWith("Reason:"))?.replace("Reason:", "Declined:") || ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button size="sm" onClick={() => openAssignDialog(job)}>
                          <UserPlus className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeleteDialog(job)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job to Cleaner</DialogTitle>
            <DialogDescription>
              Select a cleaner to assign this job to.
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedJob.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedJob.customer 
                    ? `${selectedJob.customer.firstName} ${selectedJob.customer.lastName}`
                    : "Unknown Customer"
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label>Select Cleaner</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a cleaner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedEmployee || assigning}>
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign & Notify"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{jobToDelete?.title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function BookingRequestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [plans, setPlans] = useState<CleaningPlan[]>([])
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [converting, setConverting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [isPolling, setIsPolling] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Convert form state
  const [assignedTo, setAssignedTo] = useState<string>("")
  const [scheduledFor, setScheduledFor] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("120")
  const [quotedPrice, setQuotedPrice] = useState("")
  const [planId, setPlanId] = useState("")
  const [employeePay, setEmployeePay] = useState("")

  const fetchRequests = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch(`/api/booking-requests?status=${activeTab}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      
      // Check if there are new requests
      if (requests.length > 0 && data.length > requests.length) {
        const newCount = data.length - requests.length
        toast.info(`${newCount} new booking request${newCount > 1 ? 's' : ''} received!`, {
          icon: <Sparkles className="h-4 w-4" />,
        })
      }
      
      setRequests(data)
      setLastUpdated(new Date())
    } catch (error) {
      if (showLoading) toast.error("Failed to load booking requests")
    } finally {
      setLoading(false)
    }
  }, [activeTab, requests.length])

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees?status=active")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error("Failed to load employees:", error)
    }
  }

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/cleaning-plans")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setPlans(data)
    } catch (error) {
      console.error("Failed to load cleaning plans:", error)
    }
  }

  const parseDurationMinutes = (value?: string | null) => {
    if (!value) return 60
    const normalized = value.toLowerCase()
    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/)
    const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m/)
    if (hourMatch || minMatch) {
      const hours = hourMatch ? Math.round(parseFloat(hourMatch[1]) * 60) : 0
      const mins = minMatch ? Math.round(parseFloat(minMatch[1])) : 0
      return Math.max(15, hours + mins)
    }
    const numeric = parseInt(normalized, 10)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 60
  }

  const selectedPlan = plans.find((plan) => plan.id.toString() === planId)
  const selectedPlanDuration = parseDurationMinutes(selectedPlan?.estimatedDuration)
  const selectedPlanPrice = selectedPlan?.price ? parseFloat(selectedPlan.price) : 0
  const selectedEmployeeRate = assignedTo && assignedTo !== "unassigned"
    ? (employees.find((emp) => emp.id.toString() === assignedTo)?.hourlyRate
        ? parseFloat(employees.find((emp) => emp.id.toString() === assignedTo)!.hourlyRate as string)
        : 0)
    : 0

  const suggestedEmployeePay = selectedEmployeeRate
    ? Math.min(
        selectedEmployeeRate * (selectedPlanDuration / 60),
        selectedPlanPrice > 0 ? selectedPlanPrice : Number.POSITIVE_INFINITY
      )
    : 0

  useEffect(() => {
    if (!assignedTo || assignedTo === "unassigned" || !planId) {
      setEmployeePay("")
      return
    }
    setEmployeePay(suggestedEmployeePay ? suggestedEmployeePay.toFixed(2) : "")
  }, [assignedTo, planId, suggestedEmployeePay])

  // Initial fetch when tab changes
  useEffect(() => {
    fetchRequests(true)
    fetchEmployees()
    fetchPlans()
  }, [activeTab])

  // Polling for new requests every 5 seconds
  useEffect(() => {
    if (isPolling) {
      pollingIntervalRef.current = setInterval(() => {
        fetchRequests(false)
      }, 5000) // Poll every 5 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [isPolling, fetchRequests])

  // Pause polling when dialogs are open
  useEffect(() => {
    if (detailsOpen || convertOpen) {
      setIsPolling(false)
    } else {
      setIsPolling(true)
    }
  }, [detailsOpen, convertOpen])

  const updateRequestStatus = async (requestId: number, status: string, adminNotes?: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/booking-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
      })

      if (!response.ok) throw new Error("Failed to update")

      toast.success(`Request ${status}`)
      fetchRequests()
      setDetailsOpen(false)
    } catch (error) {
      toast.error("Failed to update request")
    } finally {
      setUpdating(false)
    }
  }

  const handleConvert = async () => {
    if (!selectedRequest) return
    if (!planId) {
      toast.error("Please select a cleaning plan")
      return
    }

    const scheduledDateValue = scheduledFor
      ? new Date(scheduledFor)
      : (selectedRequest.preferredDate ? new Date(selectedRequest.preferredDate) : null)
    if (scheduledDateValue && Number.isNaN(scheduledDateValue.getTime())) {
      toast.error("Scheduled time is invalid")
      return
    }
    if (scheduledDateValue && scheduledDateValue.getTime() < Date.now()) {
      toast.error("Scheduled time cannot be in the past")
      return
    }

    setConverting(true)
    try {
      // Handle "unassigned" value - treat it as null
      const assignedToValue = assignedTo && assignedTo !== "unassigned" ? parseInt(assignedTo) : null
      
      const response = await fetch(`/api/booking-requests/${selectedRequest.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: assignedToValue,
          scheduledFor: scheduledFor || selectedRequest.preferredDate,
          durationMinutes: parseInt(durationMinutes),
          estimatedPrice: quotedPrice || selectedRequest.estimatedPrice,
          employeePay: employeePay ? parseFloat(employeePay) : undefined,
          planId: parseInt(planId),
          createCustomer: !selectedRequest.customerId,
          sendNotification: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to convert")
      }

      const data = await response.json()
      toast.success("Booking converted to job successfully!")
      setConvertOpen(false)
      setDetailsOpen(false)
      fetchRequests()

      // Navigate to the new job
      if (data.job?.id) {
        router.push(`/job/${data.job.id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to convert booking")
    } finally {
      setConverting(false)
    }
  }

  const openDetails = (request: BookingRequest) => {
    setSelectedRequest(request)
    setDetailsOpen(true)
    setQuotedPrice(request.quotedPrice || request.estimatedPrice || "")
    setAssignedTo("")
    setPlanId("")
    
    // Parse the preferred date for the datetime-local input
    // Set a reasonable default time based on the time slot
    let defaultTime = "09:00"
    if (request.preferredTimeSlot === "afternoon") defaultTime = "13:00"
    else if (request.preferredTimeSlot === "evening") defaultTime = "17:00"
    
    if (request.preferredDate) {
      try {
        const dateStr = request.preferredDate.split("T")[0]
        setScheduledFor(`${dateStr}T${defaultTime}`)
      } catch {
        setScheduledFor("")
      }
    } else {
      setScheduledFor("")
    }
  }

  const openConvertDialog = () => {
    setConvertOpen(true)
  }

  const pendingCount = requests.filter(r => r.status === "pending").length
  const reviewedCount = requests.filter(r => r.status === "reviewed" || r.status === "quoted").length
  const convertedCount = requests.filter(r => r.status === "converted").length

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeaderClient />
      
      <main className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Booking Requests</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage customer booking requests and convert them to jobs</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
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
              onClick={() => fetchRequests(true)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{pendingCount}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">In Review</CardTitle>
              <Eye className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{reviewedCount}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Being processed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Converted</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{convertedCount}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">Created as jobs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent className="pt-0 sm:pt-2">
              <div className="text-lg sm:text-2xl font-bold">{requests.length}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">All requests</p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Needing Reassignment */}
        <NeedsReassignmentSection employees={employees} />

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Booking Requests</CardTitle>
                <CardDescription>Review and convert requests into scheduled jobs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                <TabsTrigger value="converted">Converted</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No booking requests found</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 sm:hidden">
                      {requests.map((request) => (
                        <Card key={request.id} className="border-muted">
                          <CardContent className="p-3 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-sm">
                                  {request.customerFirstName} {request.customerLastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{request.customerEmail}</p>
                              </div>
                              <Badge className={STATUS_COLORS[request.status] || "bg-gray-100"}>
                                {request.status}
                              </Badge>
                            </div>

                            <div className="grid gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="text-foreground">
                                  {SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}
                                </span>
                                {request.bedrooms && <span>? {request.bedrooms} bed</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{[request.city, request.postcode].filter(Boolean).join(", ") || "Location not set"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                {request.preferredDate ? (
                                  <span>
                                    {format(parseISO(request.preferredDate), "MMM d, yyyy")} ?{" "}
                                    {TIME_SLOT_LABELS[request.preferredTimeSlot || ""] || request.preferredTimeSlot || "Flexible"}
                                  </span>
                                ) : (
                                  <span>Not specified</span>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => openDetails(request)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Table className="hidden sm:table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Preferred Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {request.customerFirstName} {request.customerLastName}
                                </p>
                                <p className="text-sm text-muted-foreground">{request.customerEmail}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{SERVICE_TYPE_LABELS[request.serviceType] || request.serviceType}</p>
                                <p className="text-sm text-muted-foreground">
                                  {request.propertyType}
                                  {request.bedrooms && ` ? ${request.bedrooms} bed`}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{request.city}</p>
                                <p className="text-muted-foreground">{request.postcode}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {request.preferredDate ? (
                                <div className="text-sm">
                                  <p>{format(parseISO(request.preferredDate), "MMM d, yyyy")}</p>
                                  <p className="text-muted-foreground">
                                    {TIME_SLOT_LABELS[request.preferredTimeSlot || ""] || request.preferredTimeSlot}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Not specified</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_COLORS[request.status] || "bg-gray-100"}>
                                {request.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDetails(request)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking Request Details</DialogTitle>
              <DialogDescription>
                Request #{selectedRequest?.id} • {selectedRequest?.status}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <User className="h-4 w-4" />
                    Customer Information
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <p><strong>Name:</strong> {selectedRequest.customerFirstName} {selectedRequest.customerLastName}</p>
                    <p><strong>Email:</strong> {selectedRequest.customerEmail}</p>
                    {selectedRequest.customerPhone && (
                      <p><strong>Phone:</strong> {selectedRequest.customerPhone}</p>
                    )}
                    {selectedRequest.existingCustomer && (
                      <Badge variant="outline" className="w-fit">Existing Customer</Badge>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4" />
                    Service Location
                  </h4>
                  <div className="text-sm">
                    <p>{selectedRequest.address}</p>
                    {selectedRequest.addressLine2 && <p>{selectedRequest.addressLine2}</p>}
                    <p>{selectedRequest.city}, {selectedRequest.postcode}</p>
                    {selectedRequest.accessInstructions && (
                      <p className="mt-2 text-muted-foreground">
                        <strong>Access:</strong> {selectedRequest.accessInstructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Service Details */}
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4" />
                    Service Details
                  </h4>
                  <div className="grid gap-2 text-sm">
                    <p><strong>Type:</strong> {SERVICE_TYPE_LABELS[selectedRequest.serviceType] || selectedRequest.serviceType}</p>
                    <p><strong>Property:</strong> {selectedRequest.propertyType}</p>
                    {selectedRequest.bedrooms && <p><strong>Bedrooms:</strong> {selectedRequest.bedrooms}</p>}
                    {selectedRequest.bathrooms && <p><strong>Bathrooms:</strong> {selectedRequest.bathrooms}</p>}
                    {selectedRequest.frequency !== "one_time" && (
                      <p><strong>Frequency:</strong> {selectedRequest.frequency}</p>
                    )}
                    {selectedRequest.specialRequirements && (
                      <p className="text-muted-foreground">
                        <strong>Special Requirements:</strong> {selectedRequest.specialRequirements}
                      </p>
                    )}
                  </div>
                </div>

                {/* Schedule */}
                <div className="bg-muted rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4" />
                    Requested Schedule
                  </h4>
                  <div className="text-sm">
                    {selectedRequest.preferredDate && (
                      <p><strong>Preferred:</strong> {format(parseISO(selectedRequest.preferredDate), "EEEE, MMMM d, yyyy")}</p>
                    )}
                    <p><strong>Time:</strong> {TIME_SLOT_LABELS[selectedRequest.preferredTimeSlot || ""] || "Flexible"}</p>
                    {selectedRequest.alternateDate && (
                      <p><strong>Alternate:</strong> {format(parseISO(selectedRequest.alternateDate), "MMM d, yyyy")}</p>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Price</p>
                    <p className="text-2xl font-bold">
                      £{selectedRequest.quotedPrice || selectedRequest.estimatedPrice || "TBD"}
                    </p>
                  </div>
                <div className="text-right text-sm text-muted-foreground">
                    Submitted {format(parseISO(selectedRequest.createdAt), "MMM d, yyyy 'at' HH:mm")}
                </div>
              </div>

                {/* Admin Notes */}
                {selectedRequest.status !== "converted" && (
                  <div className="space-y-2">
                    <Label>Admin Notes</Label>
                    <Textarea
                      placeholder="Add internal notes about this request..."
                      defaultValue={selectedRequest.adminNotes || ""}
                      id="adminNotes"
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {selectedRequest?.status === "converted" ? (
                <Button onClick={() => router.push(`/job/${selectedRequest.convertedToJobId}`)}>
                  View Job
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => updateRequestStatus(selectedRequest!.id, "declined")}
                    disabled={updating}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateRequestStatus(selectedRequest!.id, "reviewed")}
                    disabled={updating}
                  >
                    Mark as Reviewed
                  </Button>
                  <Button onClick={openConvertDialog}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Convert to Job
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Convert Dialog */}
        <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert to Job</DialogTitle>
              <DialogDescription>
                Create a job from this booking request and optionally assign a cleaner.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cleaning Plan *</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cleaning plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to Cleaner (Optional)</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Leave unassigned or select a cleaner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cleaner Pay (£)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={employeePay}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) {
                      setEmployeePay("")
                      return
                    }
                    const numeric = parseFloat(value)
                    if (Number.isNaN(numeric)) return
                    if (selectedPlanPrice > 0 && numeric > selectedPlanPrice) {
                      setEmployeePay(selectedPlanPrice.toFixed(2))
                      return
                    }
                    setEmployeePay(value)
                  }}
                  placeholder={assignedTo && assignedTo !== "unassigned" && planId ? suggestedEmployeePay.toFixed(2) : "Select plan & cleaner"}
                  disabled={!assignedTo || assignedTo === "unassigned" || !planId}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {assignedTo && assignedTo !== "unassigned" && planId
                    ? `Suggested:£${suggestedEmployeePay.toFixed(2)} (max £${selectedPlanPrice.toFixed(2) || "0.00"})`
                    : "Select a plan and cleaner to calculate pay."}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Scheduled Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  min={toLocalDateTimeInput(new Date())}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
                {selectedRequest?.preferredDate && (
                  <p className="text-xs text-muted-foreground">
                    Customer requested: {format(parseISO(selectedRequest.preferredDate), "EEEE, MMMM d, yyyy")} ({TIME_SLOT_LABELS[selectedRequest.preferredTimeSlot || ""] || "Flexible"})
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="300">5 hours</SelectItem>
                    <SelectItem value="360">6 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Price (£)</Label>
                <Input
                  type="number"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  placeholder="Final quoted price"
                />
              </div>

              {!selectedRequest?.customerId && (
                <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm">
                  <p className="font-medium">New Customer</p>
                  <p>A new customer record will be created from this booking request.</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConvertOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConvert} disabled={converting || !planId}>
                {converting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
