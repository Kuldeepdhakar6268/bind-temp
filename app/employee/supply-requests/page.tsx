"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  Package,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  ShoppingCart,
  PackageCheck,
  X,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SupplyItem {
  name: string
  quantity: number
  category: string
}

interface SupplyRequest {
  id: number
  items: string // JSON string
  urgency: "low" | "normal" | "high" | "urgent"
  notes: string | null
  neededBy: string | null
  status: "pending" | "approved" | "denied" | "fulfilled" | "cancelled"
  reviewNotes: string | null
  reviewedAt: string | null
  fulfilledAt: string | null
  createdAt: string
}

interface Summary {
  total: number
  pending: number
  approved: number
  denied: number
  fulfilled: number
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
    icon: AlertTriangle,
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500",
  },
}

const categoryOptions = [
  "Cleaning Products",
  "Disinfectants",
  "Mops & Brooms",
  "Cloths & Wipes",
  "Bins & Bags",
  "Paper Products",
  "Safety Equipment",
  "Tools",
  "Other",
]

export default function SupplyRequestsPage() {
  const [requests, setRequests] = useState<SupplyRequest[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
    fulfilled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<SupplyRequest | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  // Form state
  const [items, setItems] = useState<SupplyItem[]>([])
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, category: "Cleaning Products" })
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "urgent">("normal")
  const [notes, setNotes] = useState("")
  const [neededBy, setNeededBy] = useState("")

  const fetchRequests = async () => {
    try {
      const statusFilter = activeTab !== "all" ? `?status=${activeTab}` : ""
      const res = await fetch(`/api/employee/supply-requests${statusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error("Error fetching supply requests:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(fetchRequests, 2000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchRequests()
        startPolling()
      }
    }

    fetchRequests()
    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [activeTab])

  const addItem = () => {
    if (newItem.name.trim()) {
      setItems([...items, { ...newItem, name: newItem.name.trim() }])
      setNewItem({ name: "", quantity: 1, category: "Cleaning Products" })
    }
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const resetForm = () => {
    setItems([])
    setNewItem({ name: "", quantity: 1, category: "Cleaning Products" })
    setUrgency("normal")
    setNotes("")
    setNeededBy("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      alert("Please add at least one item")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/employee/supply-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          urgency,
          notes: notes || null,
          neededBy: neededBy || null,
        }),
      })

      if (res.ok) {
        setDialogOpen(false)
        resetForm()
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
      const res = await fetch(`/api/employee/supply-requests/${selectedRequest.id}`, {
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

  const handleDelete = async (request: SupplyRequest) => {
    if (!confirm("Are you sure you want to delete this cancelled request?")) return

    try {
      const res = await fetch(`/api/employee/supply-requests/${request.id}`, {
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

  const parseItems = (itemsJson: string): SupplyItem[] => {
    try {
      return JSON.parse(itemsJson)
    } catch {
      return []
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Supply Requests</h1>
          <p className="text-sm text-muted-foreground">
            Request cleaning products and supplies
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Request Supplies
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Supplies</DialogTitle>
              <DialogDescription>
                Add items you need and submit for approval
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Add Item Section */}
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">Add Items</Label>
                  <div className="grid gap-2">
                    <Input
                      placeholder="Item name (e.g., Floor cleaner)"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Category</Label>
                        <Select
                          value={newItem.category}
                          onValueChange={(value) => setNewItem({ ...newItem, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addItem}
                      disabled={!newItem.name.trim()}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Item
                    </Button>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Items to Request ({items.length})
                  </Label>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                      No items added yet
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity}x • {item.category}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Urgency */}
                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select value={urgency} onValueChange={(v: any) => setUrgency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - When convenient</SelectItem>
                      <SelectItem value="normal">Normal - Within a week</SelectItem>
                      <SelectItem value="high">High - Within a few days</SelectItem>
                      <SelectItem value="urgent">Urgent - ASAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Needed By Date */}
                <div className="space-y-2">
                  <Label htmlFor="neededBy">Needed By (optional)</Label>
                  <Input
                    id="neededBy"
                    type="date"
                    value={neededBy}
                    min={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setNeededBy(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any specific requirements or details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || items.length === 0}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.pending}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.approved}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Ready for pickup</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Fulfilled</CardTitle>
            <PackageCheck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.fulfilled}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary.total}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">All requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">My Requests</CardTitle>
          <CardDescription className="text-xs sm:text-sm">View and manage your supply requests</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 w-full grid grid-cols-4 h-9">
              <TabsTrigger value="all" className="text-xs sm:text-sm px-2">All</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs sm:text-sm px-2">Pending</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs sm:text-sm px-2">Approved</TabsTrigger>
              <TabsTrigger value="fulfilled" className="text-xs sm:text-sm px-2">Fulfilled</TabsTrigger>
            </TabsList>

            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No supply requests found</p>
                  <p className="text-xs sm:text-sm">Click "Request Supplies" to submit a new request</p>
                </div>
              ) : (
                requests.map((request) => {
                  const StatusIcon = statusConfig[request.status].icon
                  const requestItems = parseItems(request.items)

                  return (
                    <div
                      key={request.id}
                      className="rounded-lg border p-3 sm:p-4 space-y-3"
                    >
                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-medium text-sm sm:text-base">
                                {requestItems.length} item{requestItems.length !== 1 ? "s" : ""} requested
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge
                                  variant="outline"
                                  className={`${statusConfig[request.status].color} text-[10px] sm:text-xs`}
                                >
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {statusConfig[request.status].label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`${urgencyConfig[request.urgency].color} text-[10px] sm:text-xs`}
                                >
                                  {urgencyConfig[request.urgency].label}
                                </Badge>
                              </div>
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

                      {/* Items list */}
                      <div className="pl-12 sm:pl-[52px]">
                        <div className="flex flex-wrap gap-1.5">
                          {requestItems.map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {item.quantity}x {item.name}
                            </Badge>
                          ))}
                        </div>

                        {request.neededBy && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Needed by: {format(new Date(request.neededBy), "MMM d, yyyy")}
                          </p>
                        )}

                        {request.notes && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            Note: {request.notes}
                          </p>
                        )}

                        {request.reviewNotes && (
                          <div className="mt-2 text-xs bg-muted rounded p-2">
                            <strong>Review Notes:</strong> {request.reviewNotes}
                          </div>
                        )}

                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
                          Submitted {format(new Date(request.createdAt), "MMM d, yyyy")}
                          {request.fulfilledAt && (
                            <span className="hidden sm:inline"> • Fulfilled {format(new Date(request.fulfilledAt), "MMM d, yyyy")}</span>
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
            <AlertDialogTitle>Cancel Supply Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this supply request? This action cannot be undone.
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
