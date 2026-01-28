"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  PackageCheck,
  User,
  RefreshCcw,
  Trash2,
  Eye,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

interface SupplyItem {
  name: string
  quantity: number
  category: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
}

interface SupplyRequest {
  id: number
  items: string
  urgency: "low" | "normal" | "high" | "urgent"
  notes: string | null
  neededBy: string | null
  status: "pending" | "approved" | "denied" | "fulfilled" | "cancelled"
  reviewNotes: string | null
  reviewedAt: string | null
  fulfilledAt: string | null
  createdAt: string
  employee: Employee
}

interface Summary {
  total: number
  pending: number
  approved: number
  denied: number
  fulfilled: number
  urgent: number
}

const urgencyConfig = {
  low: {
    label: "Low",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  },
  normal: {
    label: "Normal",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  high: {
    label: "High",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  urgent: {
    label: "Urgent",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
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
  fulfilled: {
    label: "Fulfilled",
    icon: PackageCheck,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  },
}

export default function SupplyRequestsPage() {
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
    fulfilled: 0,
    urgent: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [currentAction, setCurrentAction] = useState<"approve" | "deny" | "fulfill" | "reopen" | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 30000)
    return () => clearInterval(interval)
  }, [filter])

  const fetchRequests = async () => {
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("status", filter)

      const response = await fetch(`/api/supply-requests?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error("Failed to fetch supply requests:", error)
    } finally {
      setLoading(false)
    }
  }

  const parseItems = (itemsJson: string): SupplyItem[] => {
    try {
      return JSON.parse(itemsJson)
    } catch {
      return []
    }
  }

  const handleAction = async () => {
    if (!selectedRequest || !currentAction) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/supply-requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentAction,
          reviewNotes: reviewNotes || undefined,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Request ${currentAction}${currentAction === "deny" ? "ed" : "d"} successfully`,
        })
        setActionDialogOpen(false)
        setReviewNotes("")
        setCurrentAction(null)
        fetchRequests()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to update request",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedRequest) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/supply-requests/${selectedRequest.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Request deleted successfully",
        })
        setDeleteConfirmOpen(false)
        setDetailsOpen(false)
        setSelectedRequest(null)
        fetchRequests()
      } else {
        toast({
          title: "Error",
          description: "Failed to delete request",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete request",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openActionDialog = (action: "approve" | "deny" | "fulfill" | "reopen", request: SupplyRequest) => {
    setSelectedRequest(request)
    setCurrentAction(action)
    setReviewNotes("")
    setActionDialogOpen(true)
  }

  const openDetails = (request: SupplyRequest) => {
    setSelectedRequest(request)
    setDetailsOpen(true)
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Supply Requests</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Review and manage employee supply requests
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => fetchRequests()}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.total}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("pending")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.pending}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200" onClick={() => setFilter("pending")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.urgent}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("approved")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.approved}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("fulfilled")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.fulfilled}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Fulfilled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("denied")}>
          <CardContent className="pt-3 sm:pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary.denied}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Denied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="w-full grid grid-cols-3 md:w-fit md:inline-flex">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="fulfilled">Fulfilled</TabsTrigger>
          <TabsTrigger value="denied">Denied</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>
            {filter === "all" ? "All supply requests" : `${filter.charAt(0).toUpperCase() + filter.slice(1)} requests`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No supply requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const items = parseItems(request.items)
                const StatusIcon = statusConfig[request.status]?.icon || Clock

                return (
                  <div
                    key={request.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Employee Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {request.employee.firstName[0]}
                          {request.employee.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {request.employee.firstName} {request.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>

                    {/* Items Summary */}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {items.slice(0, 3).map((item) => `${item.name} (${item.quantity})`).join(", ")}
                        {items.length > 3 && "..."}
                      </p>
                    </div>

                    {/* Urgency & Status Badges */}
                    <div className="flex items-center gap-2">
                      <Badge className={urgencyConfig[request.urgency]?.color}>
                        {urgencyConfig[request.urgency]?.label}
                      </Badge>
                      <Badge className={statusConfig[request.status]?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[request.status]?.label}
                      </Badge>
                    </div>

                    {/* Needed By */}
                    {request.neededBy && (
                      <div className="text-sm text-muted-foreground">
                        <span className="text-xs">Need by:</span>
                        <p className="font-medium">
                          {format(new Date(request.neededBy), "MMM d")}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetails(request)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {request.status === "pending" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openActionDialog("approve", request)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openActionDialog("deny", request)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                        </>
                      )}
                      {request.status === "approved" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => openActionDialog("fulfill", request)}
                        >
                          <PackageCheck className="h-4 w-4 mr-1" />
                          Fulfill
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Supply Request Details</DialogTitle>
            <DialogDescription>
              Request from {selectedRequest?.employee.firstName} {selectedRequest?.employee.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={statusConfig[selectedRequest.status]?.color}>
                  {statusConfig[selectedRequest.status]?.label}
                </Badge>
                <Badge className={urgencyConfig[selectedRequest.urgency]?.color}>
                  {urgencyConfig[selectedRequest.urgency]?.label} Priority
                </Badge>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Requested Items</Label>
                <div className="mt-2 space-y-2">
                  {parseItems(selectedRequest.items).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.category}</Badge>
                        <span className="text-sm">x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRequest.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Notes</Label>
                  <p className="mt-1 text-sm">{selectedRequest.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Requested</Label>
                  <p>{format(new Date(selectedRequest.createdAt), "MMM d, yyyy HH:mm")}</p>
                </div>
                {selectedRequest.neededBy && (
                  <div>
                    <Label className="text-muted-foreground">Needed By</Label>
                    <p>{format(new Date(selectedRequest.neededBy), "MMM d, yyyy")}</p>
                  </div>
                )}
                {selectedRequest.reviewedAt && (
                  <div>
                    <Label className="text-muted-foreground">Reviewed</Label>
                    <p>{format(new Date(selectedRequest.reviewedAt), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
                {selectedRequest.fulfilledAt && (
                  <div>
                    <Label className="text-muted-foreground">Fulfilled</Label>
                    <p>{format(new Date(selectedRequest.fulfilledAt), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
              </div>

              {selectedRequest.reviewNotes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Review Notes</Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">{selectedRequest.reviewNotes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setDetailsOpen(false)
                    openActionDialog("approve", selectedRequest)
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailsOpen(false)
                    openActionDialog("deny", selectedRequest)
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Deny
                </Button>
              </>
            )}
            {selectedRequest?.status === "approved" && (
              <Button
                variant="default"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  setDetailsOpen(false)
                  openActionDialog("fulfill", selectedRequest)
                }}
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                Fulfill
              </Button>
            )}
            {(selectedRequest?.status === "denied" || selectedRequest?.status === "cancelled") && (
              <Button
                variant="outline"
                onClick={() => {
                  setDetailsOpen(false)
                  openActionDialog("reopen", selectedRequest)
                }}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={() => {
                setDetailsOpen(false)
                setDeleteConfirmOpen(true)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentAction === "approve" && "Approve Request"}
              {currentAction === "deny" && "Deny Request"}
              {currentAction === "fulfill" && "Mark as Fulfilled"}
              {currentAction === "reopen" && "Reopen Request"}
            </DialogTitle>
            <DialogDescription>
              {currentAction === "approve" && "This will approve the supply request."}
              {currentAction === "deny" && "This will deny the supply request."}
              {currentAction === "fulfill" && "This will mark the request as fulfilled."}
              {currentAction === "reopen" && "This will reopen the request for review."}
            </DialogDescription>
          </DialogHeader>
          {(currentAction === "approve" || currentAction === "deny") && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder={currentAction === "deny" ? "Reason for denial..." : "Add any notes..."}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={submitting}
              className={
                currentAction === "approve" ? "bg-green-600 hover:bg-green-700" :
                currentAction === "deny" ? "bg-red-600 hover:bg-red-700" :
                currentAction === "fulfill" ? "bg-purple-600 hover:bg-purple-700" :
                ""
              }
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {currentAction === "approve" && "Approve"}
              {currentAction === "deny" && "Deny"}
              {currentAction === "fulfill" && "Mark Fulfilled"}
              {currentAction === "reopen" && "Reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supply Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this supply request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </main>
    </div>
  )
}
