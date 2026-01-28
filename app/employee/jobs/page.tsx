"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Textarea } from "@/components/ui/textarea"
import { Calendar, MapPin, Clock, CheckCircle, Play, Eye, Loader2, Check, X, MapPinned, User } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { toast } from "sonner"
import { useEmployeeSessionTimeout } from "@/hooks/use-session-timeout"
import { GPSCheckIn } from "@/components/employee/gps-check-in"

type Job = {
  id: number
  title: string
  description: string | null
  jobType?: string | null
  customer: { name: string } | null
  scheduledFor: Date | string | null
  scheduledEnd: Date | string | null
  status: string
  location: string | null
  city: string | null
  postcode: string | null
  employeeAccepted?: number | null
}

export default function EmployeeJobsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("today")
  const [jobs, setJobs] = useState<Job[]>([])
  const [updatingJob, setUpdatingJob] = useState<number | null>(null)
  
  // Accept/Decline dialogs
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [declineReason, setDeclineReason] = useState("")
  const [declineConfirm, setDeclineConfirm] = useState("")
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  
  // GPS Check-in for Start Job
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false)
  const [gpsJobId, setGpsJobId] = useState<number | null>(null)
  const [checkInTrigger, setCheckInTrigger] = useState(0)

  // Session timeout - auto logout after 60 minutes of inactivity
  useEmployeeSessionTimeout()

  useEffect(() => {
    loadJobs()
  }, [filter])

  useEffect(() => {
    const handleFocus = () => loadJobs()
    const interval = setInterval(loadJobs, 30000)
    window.addEventListener("focus", handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [filter])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employee/jobs?filter=${filter}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      list.sort((a, b) => {
        const aNeedsAction = a.status === "scheduled" && !a.employeeAccepted
        const bNeedsAction = b.status === "scheduled" && !b.employeeAccepted
        if (aNeedsAction !== bNeedsAction) {
          return aNeedsAction ? -1 : 1
        }
        const aDate = a.scheduledFor ? new Date(a.scheduledFor).getTime() : Number.MAX_SAFE_INTEGER
        const bDate = b.scheduledFor ? new Date(b.scheduledFor).getTime() : Number.MAX_SAFE_INTEGER
        return aDate - bDate
      })
      setJobs(list)
    } catch (error) {
      console.error("Error loading jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateJobStatus = async (jobId: number, action: "start" | "complete") => {
    setUpdatingJob(jobId)
    try {
      const res = await fetch(`/api/employee/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        toast.success(action === "start" ? "Job started!" : "Job completed!")
        loadJobs()
      } else {
        toast.error("Failed to update job")
      }
    } catch (error) {
      console.error("Error updating job:", error)
      toast.error("Failed to update job")
    } finally {
      setUpdatingJob(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "in_progress":
        return "secondary"
      case "scheduled":
        return "outline"
      default:
        return "outline"
    }
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === "completed") return "bg-green-600"
    if (status === "in_progress") return "bg-blue-600"
    return ""
  }

  const openAcceptDialog = (job: Job) => {
    setSelectedJob(job)
    setAcceptDialogOpen(true)
  }

  const openDeclineDialog = (job: Job) => {
    setSelectedJob(job)
    setDeclineReason("")
    setDeclineConfirm("")
    setDeclineDialogOpen(true)
  }

  const handleAcceptJob = async () => {
    if (!selectedJob) return
    setAccepting(true)
    try {
      const res = await fetch(`/api/employee/jobs/${selectedJob.id}/accept`, {
        method: "POST",
      })
      
      if (res.ok) {
        toast.success("Job accepted! You can now start this job.")
        setAcceptDialogOpen(false)
        loadJobs()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to accept job")
      }
    } catch (error) {
      console.error("Error accepting job:", error)
      toast.error("Failed to accept job")
    } finally {
      setAccepting(false)
    }
  }

  const handleDeclineJob = async () => {
    if (!selectedJob) return
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining")
      return
    }
    if (declineConfirm.trim().toLowerCase() !== "decline") {
      toast.error("Type decline to confirm")
      return
    }
    
    setDeclining(true)
    try {
      const res = await fetch(`/api/employee/jobs/${selectedJob.id}/accept`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      })
      
      if (res.ok) {
        toast.success("Job declined. The employer will be notified.")
        setDeclineDialogOpen(false)
        loadJobs()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to decline job")
      }
    } catch (error) {
      console.error("Error declining job:", error)
      toast.error("Failed to decline job")
    } finally {
      setDeclining(false)
    }
  }

  const handleStartJob = (job: Job) => {
    // Open GPS check-in flow
    setGpsJobId(job.id)
    setGpsDialogOpen(true)
    setCheckInTrigger(prev => prev + 1)
  }

  const handleGpsCheckInComplete = async () => {
    if (!gpsJobId) return
    // After GPS check-in, start the job
    await updateJobStatus(gpsJobId, "start")
    setGpsDialogOpen(false)
    setGpsJobId(null)
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Jobs</h1>
        <p className="text-muted-foreground">View and manage your assigned jobs</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="all">All Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-6">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">No jobs found</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => {
              const needsAction = job.status === "scheduled" && !job.employeeAccepted
              const locationBase = (job.location || "").toLowerCase()
              const addressParts = [job.location].filter(Boolean) as string[]
              if (job.city && !locationBase.includes(job.city.toLowerCase())) {
                addressParts.push(job.city)
              }
              if (job.postcode && !locationBase.includes(job.postcode.toLowerCase())) {
                addressParts.push(job.postcode)
              }
              const address = addressParts.join(", ")
              return (
              <Card
                key={job.id}
                className={needsAction ? "border-red-300 bg-red-100/70 animate-pulse" : ""}
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
                      </div>
                    </div>
                    <Badge 
                      variant={getStatusColor(job.status)}
                      className={getStatusBadgeClass(job.status)}
                    >
                      {job.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {job.description && (
                    <p className="text-sm text-muted-foreground">{job.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {/* Accept/Decline buttons - show when job not yet accepted */}
                    {job.status === "scheduled" && !job.employeeAccepted && (
                      <>
                        <Button 
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openAcceptDialog(job)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button 
                          size="sm"
                          variant="destructive"
                          onClick={() => openDeclineDialog(job)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                      </>
                    )}
                    
                    {/* Start Job - show when accepted */}
                    {job.status === "scheduled" && job.employeeAccepted === 1 && (
                      <Button 
                        size="sm"
                        onClick={() => handleStartJob(job)}
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
                        variant="default"
                        onClick={() => updateJobStatus(job.id, "complete")}
                        disabled={updatingJob === job.id}
                      >
                        {updatingJob === job.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Complete Job
                      </Button>
                    )}
                    {job.status === "completed" && (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Completed
                      </Badge>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => router.push(`/employee/jobs/${job.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )})
          )}
        </TabsContent>
      </Tabs>

      {/* Accept Job Dialog */}
      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Accept Job
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>You are about to accept this job assignment:</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedJob?.title}</p>
                  <p className="text-sm">{selectedJob?.customer?.name}</p>
                  {selectedJob?.scheduledFor && (
                    <p className="text-sm">
                      {format(new Date(selectedJob.scheduledFor), "PPP 'at' HH:mm")}
                    </p>
                  )}
                </div>
                <p className="text-sm">Once accepted, you will be responsible for completing this job.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accepting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAcceptJob}
              disabled={accepting}
              className="bg-green-600 hover:bg-green-700"
            >
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline Job Dialog */}
      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Decline Job
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You are about to decline this job assignment:</p>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedJob?.title}</p>
                  <p className="text-sm">{selectedJob?.customer?.name}</p>
                  {selectedJob?.scheduledFor && (
                    <p className="text-sm">
                      {format(new Date(selectedJob.scheduledFor), "PPP 'at' HH:mm")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Reason for declining (required)
                  </label>
                  <Textarea
                    placeholder="Please explain why you cannot accept this job..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Type decline to confirm
                  </label>
                  <Input
                    placeholder="decline"
                    value={declineConfirm}
                    onChange={(e) => setDeclineConfirm(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={declining}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeclineJob}
              disabled={declining || !declineReason.trim() || declineConfirm.trim().toLowerCase() !== "decline"}
              className="bg-red-600 hover:bg-red-700"
            >
              {declining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GPS Check-in Dialog for Start Job */}
      <AlertDialog open={gpsDialogOpen} onOpenChange={setGpsDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-primary" />
              GPS Check-in Required
            </AlertDialogTitle>
          </AlertDialogHeader>
          {gpsJobId && (
            <GPSCheckIn
              jobId={gpsJobId}
              jobStatus="scheduled"
              requestCheckIn={checkInTrigger}
              onCheckInCompleted={handleGpsCheckInComplete}
              onStatusChange={() => {}}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

