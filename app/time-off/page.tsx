"use client"

import { useCallback, useEffect, useState } from "react"
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
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, CheckCircle, XCircle, AlertCircle, Clock, Plane, Heart, GraduationCap, Loader2 } from "lucide-react"
import { format, differenceInDays, parseISO, isAfter, startOfDay } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface Employee {
  id: number
  firstName: string
  lastName: string
  name?: string
  avatar?: string
  role?: string
  daysRemaining?: number
}

interface TimeOffRequest {
  id: number
  employeeId: number
  employee: Employee
  type: string
  startDate: string
  endDate: string
  rawStartDate: string
  rawEndDate: string
  days: number
  reason: string
  status: string
  createdAt: string
}

function getTypeIcon(type: string) {
  switch (type) {
    case "vacation":
      return <Plane className="h-4 w-4 text-blue-500" />
    case "sick":
      return <Heart className="h-4 w-4 text-red-500" />
    case "personal":
      return <Clock className="h-4 w-4 text-purple-500" />
    case "training":
      return <GraduationCap className="h-4 w-4 text-green-500" />
    default:
      return <Calendar className="h-4 w-4" />
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case "vacation":
      return (
        <Badge variant="outline" className="gap-1 border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/30">
          <Plane className="h-3 w-3" /> Vacation
        </Badge>
      )
    case "sick":
      return (
        <Badge variant="outline" className="gap-1 border-red-200 text-red-700 bg-red-50 dark:bg-red-900/30">
          <Heart className="h-3 w-3" /> Sick Leave
        </Badge>
      )
    case "personal":
      return (
        <Badge variant="outline" className="gap-1 border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-900/30">
          <Clock className="h-3 w-3" /> Personal
        </Badge>
      )
    case "training":
      return (
        <Badge variant="outline" className="gap-1 border-green-200 text-green-700 bg-green-50 dark:bg-green-900/30">
          <GraduationCap className="h-3 w-3" /> Training
        </Badge>
      )
    default:
      return <Badge variant="outline">{type}</Badge>
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
    case "denied":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      )
    default:
      return null
  }
}

export default function TimeOffPage() {
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewRequestId, setReviewRequestId] = useState<number | null>(null)
  const [reviewAction, setReviewAction] = useState<"approved" | "denied" | "">("")
  const [reviewNotes, setReviewNotes] = useState("")
  const [apiError, setApiError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setApiError(null)
      const [timeOffRes, employeesRes] = await Promise.all([
        fetch("/api/time-off?debug=1"),
        fetch("/api/employees?status=active"),
      ])

      console.log("[time-off page] timeOffRes status:", timeOffRes.status)

      const timeOffPayload = timeOffRes.ok ? await timeOffRes.json() : { error: `HTTP ${timeOffRes.status}` }
      console.log("[time-off page] timeOffPayload:", timeOffPayload)
      
      const timeOffData = Array.isArray(timeOffPayload) ? timeOffPayload : (timeOffPayload.requests || [])
      console.log("[time-off page] timeOffData count:", timeOffData.length)

      if (!timeOffRes.ok) {
        const message = (timeOffPayload as any)?.error || `Failed to fetch time-off requests (${timeOffRes.status})`
        setApiError(message)
        toast({ title: "Time-off fetch failed", description: message, variant: "destructive" })
      }

      const employeesPayload = employeesRes.ok ? await employeesRes.json() : { error: `HTTP ${employeesRes.status}` }
      if (!employeesRes.ok) {
        const message = (employeesPayload as any)?.error || `Failed to fetch employees (${employeesRes.status})`
        setApiError(message)
        toast({ title: "Employees fetch failed", description: message, variant: "destructive" })
      }

      setDebugInfo((timeOffPayload as any)?.debug || null)
      
      const employeesData = Array.isArray(employeesPayload) ? employeesPayload : []

      // Map employees
      const employeeMap = new Map(employeesData.map((e: any) => [e.id, e]))
      
      // Calculate days remaining (assume 25 days per year)
      const formattedEmployees = employeesData.map((emp: any) => {
        const empRequests = timeOffData.filter((r: any) => r.employeeId === emp.id && r.status === "approved")
        const daysUsed = empRequests.reduce((sum: number, r: any) => {
          const start = parseISO(r.startDate)
          const end = parseISO(r.endDate)
          return sum + differenceInDays(end, start) + 1
        }, 0)
        return {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          name: `${emp.firstName} ${emp.lastName}`,
          avatar: emp.avatar,
          role: emp.role || "Employee",
          daysRemaining: Math.max(0, 25 - daysUsed),
        }
      })

      setEmployees(formattedEmployees)

      // Format requests
      const formattedRequests: TimeOffRequest[] = timeOffData.map((req: any) => {
        const emp = employeeMap.get(req.employeeId)
        const start = parseISO(req.startDate)
        const end = parseISO(req.endDate)
        return {
          id: req.id,
          employeeId: req.employeeId,
          employee: emp ? {
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            name: `${emp.firstName} ${emp.lastName}`,
            avatar: emp.avatar,
            role: emp.role,
          } : { id: req.employeeId, firstName: "Unknown", lastName: "", name: "Unknown" },
          type: req.type || "personal",
          startDate: format(start, "MMM d, yyyy"),
          endDate: format(end, "MMM d, yyyy"),
          rawStartDate: req.startDate,
          rawEndDate: req.endDate,
          days: differenceInDays(end, start) + 1,
          reason: req.reason || "",
          status: req.status || "pending",
          createdAt: req.createdAt ? format(parseISO(req.createdAt), "MMM d, yyyy") : "",
        }
      })

      setTimeOffRequests(formattedRequests)
    } catch (error) {
      console.error("Failed to fetch time-off data:", error)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const openReviewDialog = (id: number, action: "approved" | "denied") => {
    setReviewRequestId(id)
    setReviewAction(action)
    setReviewNotes("")
    setReviewDialogOpen(true)
  }

  const handleSubmitReview = async () => {
    if (!reviewRequestId || !reviewAction) {
      return
    }

    setReviewSubmitting(true)
    try {
      const response = await fetch(`/api/time-off/${reviewRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewAction, reviewNotes: reviewNotes.trim() }),
      })

      if (response.ok) {
        toast({ title: "Success", description: `Request ${reviewAction}` })
        setReviewDialogOpen(false)
        setReviewRequestId(null)
        setReviewAction("")
        setReviewNotes("")
        fetchData()
      } else {
        toast({ title: "Error", description: "Failed to update request", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update request", variant: "destructive" })
    } finally {
      setReviewSubmitting(false)
    }
  }

  // Calculate stats
  const pendingCount = timeOffRequests.filter(r => r.status === "pending").length
  const approvedThisMonth = timeOffRequests.filter(r => r.status === "approved").length
  const upcomingAbsences = timeOffRequests.filter(r => {
    const start = parseISO(r.rawStartDate)
    return r.status === "approved" && isAfter(start, startOfDay(new Date()))
  }).slice(0, 5)
  const totalDaysTaken = timeOffRequests.filter(r => r.status === "approved").reduce((sum, r) => sum + r.days, 0)

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
            <h1 className="text-2xl sm:text-3xl font-bold">Time-off Requests</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage vacation, sick leave, and personal time</p>
          </div>
        </div>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{reviewAction === "approved" ? "Approve request" : "Reject request"}</DialogTitle>
              <DialogDescription>Reason is optional.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="Add review notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitReview} disabled={reviewSubmitting}>
                {reviewSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {reviewAction === "approved" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{pendingCount}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Pending requests</p>
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
                <p className="text-lg sm:text-2xl font-bold">{approvedThisMonth}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Approved this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Plane className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{upcomingAbsences.length}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Upcoming absences</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{totalDaysTaken}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Days taken this year</p>
              </div>
            </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList className="w-full grid grid-cols-3 md:w-fit md:inline-flex">
                <TabsTrigger value="all">All Requests</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
              </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Time-off Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {timeOffRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No time-off requests yet</p>
                      <p className="text-sm">Requests from employees will appear here for approval</p>
                      {apiError && (
                        <p className="text-sm text-destructive mt-2">{apiError}</p>
                      )}
                      {debugInfo && (
                        <p className="text-xs mt-2">
                          Session company: {String(debugInfo.sessionCompanyId || "unknown")} · Requests for company:{" "}
                          {String(debugInfo.totalRequestsForCompany || 0)}
                        </p>
                      )}
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {timeOffRequests.map((request) => (
                      <div key={request.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.employee.avatar || "/placeholder.svg"} />
                              <AvatarFallback>
                                {request.employee.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{request.employee.name}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {getTypeBadge(request.type)}
                                <span className="text-sm text-muted-foreground">
                                  {request.startDate}
                                  {request.startDate !== request.endDate && ` - ${request.endDate}`}
                                </span>
                                <span className="text-sm text-muted-foreground">({request.days} days)</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                              <p className="text-xs text-muted-foreground mt-1">Requested: {request.createdAt}</p>
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
                                  onClick={() => openReviewDialog(request.id, "approved")}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 bg-transparent"
                                  onClick={() => openReviewDialog(request.id, "denied")}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeOffRequests
                      .filter((r) => r.status === "pending")
                      .map((request) => (
                        <div key={request.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={request.employee.avatar || "/placeholder.svg"} />
                                <AvatarFallback>
                                  {request.employee.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{request.employee.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {getTypeBadge(request.type)}
                                  <span className="text-sm text-muted-foreground">
                                    {request.startDate}
                                    {request.startDate !== request.endDate && ` - ${request.endDate}`}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openReviewDialog(request.id, "approved")}>
                                <CheckCircle className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openReviewDialog(request.id, "denied")}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approved">
              <Card>
                <CardHeader>
                  <CardTitle>Approved Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeOffRequests
                      .filter((r) => r.status === "approved")
                      .map((request) => (
                        <div key={request.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={request.employee.avatar || "/placeholder.svg"} />
                              <AvatarFallback>
                                {request.employee.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{request.employee.name}</p>
                                {getStatusBadge(request.status)}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {getTypeBadge(request.type)}
                                <span className="text-sm text-muted-foreground">
                                  {request.startDate}
                                  {request.startDate !== request.endDate && ` - ${request.endDate}`}
                                </span>
                                <span className="text-sm text-muted-foreground">({request.days} days)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Absences</CardTitle>
                <CardDescription>Staff off in the next 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingAbsences.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming absences</p>
                  ) : (
                    upcomingAbsences.map((request, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={request.employee.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
                            {(request.employee.name || `${request.employee.firstName} ${request.employee.lastName}`)
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{request.employee.name || `${request.employee.firstName} ${request.employee.lastName}`}</p>
                          <p className="text-xs text-muted-foreground">{request.startDate}{request.startDate !== request.endDate && ` - ${request.endDate}`}</p>
                        </div>
                        {getTypeIcon(request.type)}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave Balances</CardTitle>
                <CardDescription>Days remaining this year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
                  ) : (
                    employees.map((employee) => (
                      <div key={employee.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={employee.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
                            {(employee.name || `${employee.firstName} ${employee.lastName}`)
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{employee.name || `${employee.firstName} ${employee.lastName}`}</p>
                        </div>
                        <Badge variant={(employee.daysRemaining || 0) < 5 ? "destructive" : "secondary"} className="font-mono">
                          {employee.daysRemaining || 0} days
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
