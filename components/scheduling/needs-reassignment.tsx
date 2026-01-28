"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  Loader2, 
  UserPlus,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { JobCornerActions } from "@/components/jobs/job-corner-actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface Job {
  id: number
  title: string
  location: string | null
  city: string | null
  postcode: string | null
  scheduledFor: string | null
  scheduledEnd?: string | null
  durationMinutes?: number | null
  status: string
  internalNotes: string | null
  customer: { firstName: string; lastName: string } | null
  assignments?: { employeeId: number }[]
  assignedTo?: number | null
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  status: string
}

const normalizeAddressPart = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildJobAddress = (job: Job | null) => {
  if (!job) return ""
  const parts: string[] = []
  if (job.location) {
    parts.push(job.location)
  }
  const normalizedBase = normalizeAddressPart(parts.join(", "))
  if (job.city && !normalizedBase.includes(normalizeAddressPart(job.city))) {
    parts.push(job.city)
  }
  const normalizedWithCity = normalizeAddressPart(parts.join(", "))
  if (job.postcode && !normalizedWithCity.includes(normalizeAddressPart(job.postcode))) {
    parts.push(job.postcode)
  }
  return parts.join(", ")
}

const buildTownPostcode = (job: Job | null) => {
  if (!job) return ""
  return [job.city, job.postcode].filter(Boolean).join(", ")
}

const formatScheduledDate = (scheduledFor: string | null) => {
  if (!scheduledFor) return null
  return format(new Date(scheduledFor), "EEEE, MMMM d 'at' HH:mm")
}

export function NeedsReassignment() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [assigning, setAssigning] = useState(false)
  const [availability, setAvailability] = useState<Record<number, "available" | "busy">>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const fetchUnassignedJobs = useCallback(async () => {
    try {
      // Fetch pending jobs with no assignee
      const response = await fetch("/api/jobs?status=pending")
      if (response.ok) {
        const data = await response.json()
        // Filter to only show jobs that have no assignee (likely declined or never assigned)
        const unassigned = data.filter((job: Job & { assignedTo: number | null }) => !job.assignedTo)
        setJobs(unassigned)
      }
    } catch (error) {
      console.error("Failed to fetch unassigned jobs:", error)
    } finally {
      setLoading(false)
      setHasLoaded(true)
    }
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/employees?status=active")
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error("Failed to fetch employees:", error)
    }
  }

  useEffect(() => {
    fetchUnassignedJobs()
    fetchEmployees()
    
    // Poll every 5 seconds
    const interval = setInterval(fetchUnassignedJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchUnassignedJobs])

  useEffect(() => {
    const handleJobsUpdated = () => fetchUnassignedJobs()
    window.addEventListener("jobs:updated", handleJobsUpdated)
    return () => window.removeEventListener("jobs:updated", handleJobsUpdated)
  }, [fetchUnassignedJobs])

  useEffect(() => {
    if (!assignDialogOpen || !selectedJob || employees.length === 0 || !selectedJob.scheduledFor) {
      setAvailability({})
      return
    }

    const fetchAvailability = async () => {
      const start = new Date(selectedJob.scheduledFor!)
      if (Number.isNaN(start.getTime())) {
        setAvailability({})
        return
      }

      const durationMinutes = selectedJob.durationMinutes && selectedJob.durationMinutes > 0
        ? selectedJob.durationMinutes
        : 60
      let end = selectedJob.scheduledEnd ? new Date(selectedJob.scheduledEnd) : null
      if (!end || Number.isNaN(end.getTime())) {
        end = new Date(start.getTime() + durationMinutes * 60000)
      }

      const windowStart = new Date(start.getTime() - durationMinutes * 60000)
      const windowEnd = new Date(end.getTime() + durationMinutes * 60000)
      const params = new URLSearchParams({
        startDate: windowStart.toISOString(),
        endDate: windowEnd.toISOString(),
      })

      setAvailabilityLoading(true)
      try {
        const response = await fetch(`/api/jobs?${params.toString()}`)
        if (!response.ok) {
          setAvailability({})
          return
        }
        const jobsData: Job[] = await response.json()
        const acceptedStatuses = new Set(["scheduled", "in-progress"])
        const busyEmployeeIds = new Set<number>()

        for (const existingJob of jobsData) {
          if (existingJob.id === selectedJob.id) continue
          if (!existingJob.scheduledFor || !acceptedStatuses.has(existingJob.status)) continue

          const assignedIds =
            existingJob.assignments?.map((assignment) => assignment.employeeId) ??
            (existingJob.assignedTo ? [existingJob.assignedTo] : [])
          if (assignedIds.length === 0) continue

          const jobStart = new Date(existingJob.scheduledFor)
          if (Number.isNaN(jobStart.getTime())) continue
          const jobDuration = existingJob.durationMinutes && existingJob.durationMinutes > 0
            ? existingJob.durationMinutes
            : 60
          const jobEnd = existingJob.scheduledEnd
            ? new Date(existingJob.scheduledEnd)
            : new Date(jobStart.getTime() + jobDuration * 60000)

          if (start < jobEnd && end > jobStart) {
            for (const employeeId of assignedIds) {
              busyEmployeeIds.add(employeeId)
            }
          }
        }

        const nextAvailability: Record<number, "available" | "busy"> = {}
        for (const employee of employees) {
          nextAvailability[employee.id] = busyEmployeeIds.has(employee.id) ? "busy" : "available"
        }
        setAvailability(nextAvailability)
      } catch (error) {
        console.error("Failed to check staff availability:", error)
        setAvailability({})
      } finally {
        setAvailabilityLoading(false)
      }
    }

    fetchAvailability()
  }, [assignDialogOpen, selectedJob, employees])

  const openAssignDialog = (job: Job) => {
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

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to assign")
      }

      toast.success("Job assigned successfully! The cleaner has been notified.")
      setAssignDialogOpen(false)
      fetchUnassignedJobs()
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign job")
    } finally {
      setAssigning(false)
    }
  }

  // Check if job was declined (look for decline note in internalNotes)
  const wasDeclined = (job: Job) => {
    return job.internalNotes?.includes("[Job Declined by Employee")
  }

  // Don't show until we've loaded once, or when there's nothing to show
  if (!hasLoaded || jobs.length === 0) {
    return null
  }

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
                  Needs Reassignment
                </CardTitle>
                <CardDescription className="text-orange-600 dark:text-orange-400">
                  {loading ? "Loading..." : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} waiting to be assigned`}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="bg-orange-600">
                {jobs.length}
              </Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
              </div>
            ) : (
              jobs.map((job) => {
                const customerName = job.customer
                  ? `${job.customer.firstName} ${job.customer.lastName}`
                  : "Unknown Customer"
                const declined = wasDeclined(job)

                return (
                  <div 
                    key={job.id} 
                    className="p-4 bg-white dark:bg-gray-900 border rounded-lg shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{job.title}</h4>
                          {declined && (
                            <Badge variant="destructive" className="text-xs">
                              Declined
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            <span>{customerName}</span>
                          </div>
                          {job.scheduledFor && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{format(new Date(job.scheduledFor), "MMM d, HH:mm")}</span>
                            </div>
                          )}
                          {(job.location || job.city) && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{[job.location, job.city].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                        </div>

                        {declined && job.internalNotes && (
                          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded">
                            {job.internalNotes.split("\n").find(line => line.startsWith("Reason:"))?.replace("Reason:", "Decline reason:") || "No reason provided"}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button 
                          size="sm" 
                          onClick={() => openAssignDialog(job)}
                          className="shrink-0"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Assign
                        </Button>
                        <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                          <JobCornerActions
                            jobId={job.id}
                            title={job.title}
                            status={job.status}
                            onRefresh={fetchUnassignedJobs}
                            align="end"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        )}
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job to Cleaner</DialogTitle>
            <DialogDescription>
              Select a cleaner to assign this job to. They will receive a notification.
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-4">
              <Card className="border bg-muted text-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Job Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {selectedJob.customer && (
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm text-foreground">
                        {selectedJob.customer.firstName} {selectedJob.customer.lastName}
                      </span>
                    </div>
                  )}

                  {buildJobAddress(selectedJob) ? (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          buildJobAddress(selectedJob)
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        {buildJobAddress(selectedJob)}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>No address provided</span>
                    </div>
                  )}

                  {buildTownPostcode(selectedJob) && (
                    <div className="flex items-center gap-3 text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4 opacity-70" />
                      <span>{buildTownPostcode(selectedJob)}</span>
                    </div>
                  )}

                  {selectedJob.scheduledFor && (
                    <div className="flex items-center gap-3 text-muted-foreground text-sm">
                      <Calendar className="h-4 w-4" />
                      <span>{formatScheduledDate(selectedJob.scheduledFor)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Select Cleaner</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a cleaner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => {
                      const canCheckAvailability = Boolean(selectedJob?.scheduledFor)
                      const status = availability[emp.id]
                      const statusLabel = !canCheckAvailability
                        ? "Pick date/time"
                        : availabilityLoading
                          ? "Checking..."
                          : status === "busy"
                            ? "Busy"
                            : status === "available"
                              ? "Available"
                              : "Unavailable"
                      const statusClass = !canCheckAvailability
                        ? "text-muted-foreground"
                        : status === "busy"
                          ? "text-red-600"
                          : status === "available"
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                      return (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          <div className="flex w-full items-center justify-between gap-3">
                            <span>{emp.firstName} {emp.lastName}</span>
                            <span className={`text-xs ${statusClass}`}>{statusLabel}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {!selectedJob?.scheduledFor && (
                  <p className="text-xs text-muted-foreground">Pick a schedule time to see availability.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedEmployee || assigning}
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign & Notify
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
