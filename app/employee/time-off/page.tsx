"use client"

import { useState, useEffect } from "react"
import { format, differenceInCalendarDays, addDays } from "date-fns"
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Loader2,
  CalendarDays,
  Plane,
  Thermometer,
  User,
  BanknoteIcon,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TimeOffRequest {
  id: number
  type: "vacation" | "sick" | "personal" | "unpaid" | "other"
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: "pending" | "approved" | "denied" | "cancelled"
  reviewNotes: string | null
  reviewedAt: string | null
  createdAt: string
}

interface Summary {
  pendingCount: number
  approvedCount: number
  deniedCount: number
  daysUsedThisYear: number
}

const typeConfig = {
  vacation: {
    label: "Vacation",
    icon: Plane,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  sick: {
    label: "Sick Leave",
    icon: Thermometer,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  personal: {
    label: "Personal",
    icon: User,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  unpaid: {
    label: "Unpaid Leave",
    icon: BanknoteIcon,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  },
  other: {
    label: "Other",
    icon: MoreHorizontal,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  denied: {
    label: "Denied",
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: AlertCircle,
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500",
  },
}

export default function TimeOffPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([])
  const [summary, setSummary] = useState<Summary>({
    pendingCount: 0,
    approvedCount: 0,
    deniedCount: 0,
    daysUsedThisYear: 0,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  // Form state
  const [formData, setFormData] = useState({
    type: "vacation" as TimeOffRequest["type"],
    startDate: "",
    endDate: "",
    reason: "",
  })

  const fetchRequests = async () => {
    try {
      const statusFilter = activeTab !== "all" ? `?status=${activeTab}` : ""
      const res = await fetch(`/api/employee/time-off${statusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error("Error fetching time-off requests:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [activeTab])

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (end >= start) {
        // Count weekdays only
        let days = 0
        let current = start
        while (current <= end) {
          const dayOfWeek = current.getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days++
          }
          current = addDays(current, 1)
        }
        return days
      }
    }
    return 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch("/api/employee/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setDialogOpen(false)
        setFormData({ type: "vacation", startDate: "", endDate: "", reason: "" })
        fetchRequests()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to submit request")
      }
    } catch (error) {
      console.error("Error submitting request:", error)
      alert("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!selectedRequest) return

    try {
      const res = await fetch(`/api/employee/time-off/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })

      if (res.ok) {
        setCancelDialogOpen(false)
        setSelectedRequest(null)
        fetchRequests()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to cancel request")
      }
    } catch (error) {
      console.error("Error cancelling request:", error)
      alert("Failed to cancel request")
    }
  }

  const handleDelete = async (request: TimeOffRequest) => {
    if (!confirm("Are you sure you want to delete this cancelled request?")) return

    try {
      const res = await fetch(`/api/employee/time-off/${request.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchRequests()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete request")
      }
    } catch (error) {
      console.error("Error deleting request:", error)
    }
  }

  const daysToRequest = calculateDays()

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Time Off</h1>
          <p className="text-sm text-muted-foreground">
            Request and manage your time off
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Request Time Off
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg mx-auto">
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
              <DialogDescription>
                Submit a new time off request for approval
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type of Leave</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: TimeOffRequest["type"]) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      required
                      value={formData.startDate}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      required
                      value={formData.endDate}
                      min={formData.startDate || format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                {daysToRequest > 0 && (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>
                        <strong>{daysToRequest}</strong> working day{daysToRequest > 1 ? "s" : ""} requested
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Add any additional notes or reason for your request..."
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || daysToRequest === 0}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards - 2x2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.pendingCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.approvedCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Denied</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.deniedCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Days Used</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.daysUsedThisYear}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Approved days this year</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">My Requests</CardTitle>
          <CardDescription className="text-xs sm:text-sm">View and manage your time off requests</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 w-full grid grid-cols-4 h-9">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2">All</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm px-2">Pending</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs sm:text-sm px-2">Approved</TabsTrigger>
              <TabsTrigger value="denied" className="text-xs sm:text-sm px-2">Denied</TabsTrigger>
            </TabsList>

            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No time off requests found</p>
                  <p className="text-xs sm:text-sm">Click "Request Time Off" to submit a new request</p>
                </div>
              ) : (
                requests.map((request) => {
                  const TypeIcon = typeConfig[request.type].icon
                  const StatusIcon = statusConfig[request.status].icon

                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border p-3 sm:p-4 space-y-3"
                    >
                      {/* Top row: Icon, Type, Status, Actions */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full ${typeConfig[request.type].color}`}
                        >
                          <TypeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-medium text-sm sm:text-base truncate">
                                {typeConfig[request.type].label}
                              </h4>
                              <Badge
                                variant="outline"
                                className={`${statusConfig[request.status].color} text-[10px] sm:text-xs mt-1`}
                              >
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {statusConfig[request.status].label}
                              </Badge>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {request.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setSelectedRequest(request)
                                    setCancelDialogOpen(true)
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                              {request.status === "cancelled" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleDelete(request)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Date and days info */}
                      <div className="text-xs sm:text-sm text-muted-foreground pl-12 sm:pl-[52px]">
                        <p>
                          {format(new Date(request.startDate), "MMM d, yyyy")}
                          {request.startDate !== request.endDate && (
                            <> – {format(new Date(request.endDate), "MMM d, yyyy")}</>
                          )}
                          <span className="mx-1.5 sm:mx-2">•</span>
                          {request.totalDays} day{request.totalDays > 1 ? "s" : ""}
                        </p>
                        {request.reason && (
                          <p className="mt-1.5 text-muted-foreground line-clamp-2">
                            {request.reason}
                          </p>
                        )}
                        {request.reviewNotes && (
                          <div className="mt-2 text-xs bg-muted rounded p-2">
                            <strong>Review Notes:</strong> {request.reviewNotes}
                          </div>
                        )}
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
                          Submitted {format(new Date(request.createdAt), "MMM d, yyyy")}
                          {request.reviewedAt && (
                            <span className="hidden sm:inline"> • Reviewed {format(new Date(request.reviewedAt), "MMM d, yyyy")}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Time Off Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this time off request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>
              Yes, Cancel Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
