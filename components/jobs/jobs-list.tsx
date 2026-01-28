"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Loader2, Search, Plus, Calendar, User, MapPin, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { EditJobDialog } from "./edit-job-dialog"
import { JobActions } from "./job-actions"
import { AssignJobDialog } from "./assign-job-dialog"
import { format } from "date-fns"
import { toast } from "sonner"

interface Job {
  id: number
  title: string
  description?: string | null
  customerId: number
  assignedTo?: number | null
  location?: string | null
  city?: string | null
  scheduledFor?: string | null
  scheduledEnd?: string | null
  durationMinutes?: number | null
  status: string
  priority?: string | null
  estimatedPrice?: string | null
  currency?: string | null
  customer?: {
    id: number
    firstName: string
    lastName: string
    email: string
  }
  assignee?: {
    id: number
    firstName: string
    lastName: string
  } | null
}

interface JobsListProps {
  hideAddButton?: boolean
  onJobsChange?: (jobs: Job[]) => void
}

export function JobsList({ hideAddButton = false, onJobsChange }: JobsListProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchJobs = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError("")
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/jobs?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch jobs")
      }

      const data = await response.json()
      setJobs(data)
      onJobsChange?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, onJobsChange])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const handleRefresh = () => {
    fetchJobs(true)
    toast.success("Jobs refreshed")
  }

  const handleEdit = (job: Job) => {
    setSelectedJob(job)
    setEditDialogOpen(true)
  }

  const handleAssign = (job: Job) => {
    setSelectedJob(job)
    setAssignDialogOpen(true)
  }

  const handleDeleteClick = (job: Job) => {
    setJobToDelete(job)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/jobs/${jobToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "Failed to delete job")
      }

      toast.success("Job deleted successfully")
      fetchJobs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete job")
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setJobToDelete(null)
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      job.title.toLowerCase().includes(searchLower) ||
      job.description?.toLowerCase().includes(searchLower) ||
      job.customer?.firstName.toLowerCase().includes(searchLower) ||
      job.customer?.lastName.toLowerCase().includes(searchLower) ||
      job.location?.toLowerCase().includes(searchLower)
    )
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "outline",
      "in-progress": "default",
      completed: "secondary",
      cancelled: "destructive",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const getPriorityBadge = (priority?: string | null) => {
    if (!priority) return null
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-800",
      normal: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    }
    return <Badge className={colors[priority] || ""}>{priority}</Badge>
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Jobs</CardTitle>
              {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              {!hideAddButton && (
                <Button onClick={() => router.push("/scheduling?new=true")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Job
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? "No jobs found matching your search." : "No jobs yet. Create your first job!"}
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                            <div>
                              <div className="font-medium">{job.title}</div>
                            </div>
                        </TableCell>
                        <TableCell>
                          {job.customer && (
                            <div>
                              <div className="font-medium">
                                {job.customer.firstName} {job.customer.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{job.customer.email}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.assignee ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {job.assignee.firstName} {job.assignee.lastName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.scheduledFor ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div>{format(new Date(job.scheduledFor), "MMM d, yyyy")}</div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(job.scheduledFor), "HH:mm")}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="max-w-[200px] truncate">{job.location}</div>
                                {job.city && <div className="text-sm text-muted-foreground">{job.city}</div>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No location</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>{getPriorityBadge(job.priority)}</TableCell>
                        <TableCell className="text-right">
                          {job.estimatedPrice ? (
                            <div className="font-medium">
                              {job.currency === "GBP" ? "£" : job.currency === "EUR" ? "€" : "$"}
                              {parseFloat(job.estimatedPrice).toFixed(2)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <JobActions
                            job={{
                              id: job.id,
                              title: job.title,
                              status: job.status,
                              assignedTo: job.assignedTo ?? null,
                              scheduledFor: job.scheduledFor ?? null,
                            }}
                            onEdit={() => handleEdit(job)}
                            onDelete={() => handleDeleteClick(job)}
                            onAssign={() => handleAssign(job)}
                            onRefresh={fetchJobs}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EditJobDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} job={selectedJob} onSuccess={fetchJobs} />
      <AssignJobDialog 
        open={assignDialogOpen} 
        onOpenChange={setAssignDialogOpen} 
        jobId={selectedJob?.id ?? null}
        jobTitle={selectedJob?.title ?? ""}
        currentAssignee={selectedJob?.assignedTo ?? null}
        onSuccess={fetchJobs}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              {jobToDelete
                ? `Are you sure you want to delete "${jobToDelete.title}"? This action cannot be undone.`
                : "Are you sure you want to delete this job? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

