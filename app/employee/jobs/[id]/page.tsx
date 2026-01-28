"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { format } from "date-fns"
import { 
  ArrowLeft, MapPin, Clock, Calendar, User,
  Play, CheckCircle, Pause, FileText, Loader2,
  Navigation, Camera, Image, Pen, Wallet, Info, Car, DoorOpen
} from "lucide-react"
import Link from "next/link"
import { VerificationPhotoModal } from "@/components/employee/verification-photo-modal"
import { GPSCheckIn } from "@/components/employee/gps-check-in"
import { SignaturePadModal } from "@/components/employee/signature-pad-modal"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useEmployeeSessionTimeout } from "@/hooks/use-session-timeout"

type Customer = {
  id: number
  name: string
  firstName: string
  lastName: string
  // Note: email and phone excluded for privacy - employees only see address
  address: string | null
  city: string | null
  postcode: string | null
}

type Task = {
  id: number
  title: string
  description: string | null
  status: string
  order: number
  completedAt: string | null
  photos?: VerificationPhoto[]
}

type VerificationPhoto = {
  id: number
  url: string
  thumbnailUrl?: string | null
  fileName: string
  capturedAt: string
  latitude: string | null
  longitude: string | null
  capturedAddress: string | null
  verificationStatus: string
  caption?: string | null
}

type Job = {
  id: number
  title: string
  description: string | null
  customer: Customer | null
  location: string | null
  addressLine2: string | null
  city: string | null
  postcode: string | null
  accessInstructions: string | null
  parkingInstructions: string | null
  specialInstructions: string | null
  scheduledFor: string | null
  scheduledEnd: string | null
  durationMinutes: number | null
  status: string
  priority: string | null
  employeePay: string | null
  employeePayType?: string | null
  internalNotes: string | null
  employeeAccepted?: number | null
  employeeAcceptedAt?: string | null
  tasks: Task[]
}

export default function EmployeeJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<Job | null>(null)
  const [notes, setNotes] = useState("")
  const [updating, setUpdating] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [jobPhotos, setJobPhotos] = useState<VerificationPhoto[]>([])
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTrigger, setCheckInTrigger] = useState(0)
  const [checkOutTrigger, setCheckOutTrigger] = useState(0)
  const [startAfterCheckIn, setStartAfterCheckIn] = useState(false)
  const [completeAfterCheckOut, setCompleteAfterCheckOut] = useState(false)
  
  // Keys state
  // Distance tracking state
  const [cleanerLocation, setCleanerLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [jobCoords, setJobCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [distanceToJob, setDistanceToJob] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Session timeout - auto logout after 60 minutes of inactivity
  useEmployeeSessionTimeout()

  // Reject job state
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [declineConfirm, setDeclineConfirm] = useState("")
  const [declining, setDeclining] = useState(false)
  const [accepting, setAccepting] = useState(false)

  // Calculate distance between two coordinates in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Get cleaner's current location
  const getCleanerLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported")
      return
    }

    // Check permission state when supported to avoid unauthorised requests.
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" })
        if (permission.state === "denied") {
          setLocationError("Location permission denied")
          toast.error("Location permission denied. Enable it in your browser settings.")
          return
        }
      } catch (error) {
        // Ignore permissions API errors and proceed to prompt.
      }
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setCleanerLocation(coords)
        setLocationLoading(false)

        // Calculate distance if we have job coordinates
        if (jobCoords) {
          const dist = calculateDistance(coords.lat, coords.lng, jobCoords.lat, jobCoords.lng)
          setDistanceToJob(dist)
        }
      },
      (error) => {
        setLocationError("Unable to get location")
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Geocode job address to coordinates (server-side proxy to avoid CSP issues)
  const geocodeJobAddress = async (address: string) => {
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
      if (!res.ok) return null
      const data = await res.json()
      return data?.result || null
    } catch (error) {
      console.error("Geocoding error:", error)
      return null
    }
  }

  useEffect(() => {
    loadJob()
    loadPhotos()
    loadSignature()
    loadCheckInStatus()
  }, [id])

  // Geocode job address when job loads
  useEffect(() => {
    const loadJobCoords = async () => {
      if (job) {
        const mapAddress = getMapAddress()
        if (mapAddress) {
          const coords = await geocodeJobAddress(mapAddress)
          if (coords) {
            setJobCoords(coords)
          }
        }
      }
    }
    loadJobCoords()
  }, [job?.id])

  // Recalculate distance when either location changes
  useEffect(() => {
    if (cleanerLocation && jobCoords) {
      const dist = calculateDistance(cleanerLocation.lat, cleanerLocation.lng, jobCoords.lat, jobCoords.lng)
      setDistanceToJob(dist)
    }
  }, [cleanerLocation, jobCoords])

  const loadJob = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employee/jobs/${id}`)
      if (res.ok) {
        const data = await res.json()
        setJob(data)
        setNotes(data.internalNotes || "")
        
      } else {
        toast.error("Job not found")
        router.push("/employee")
      }
    } catch (error) {
      console.error("Error loading job:", error)
      toast.error("Failed to load job")
    } finally {
      setLoading(false)
    }
  }

  const loadPhotos = async () => {
    try {
      const res = await fetch(`/api/employee/jobs/${id}/photos`)
      if (res.ok) {
        const photos = await res.json()
        setJobPhotos(photos)
      }
    } catch (error) {
      console.error("Error loading photos:", error)
    }
  }

  const loadSignature = async () => {
    try {
      const res = await fetch(`/api/employee/jobs/${id}/signature`)
      if (res.ok) {
        const data = await res.json()
        setHasSignature(!!data.signature)
      }
    } catch (error) {
      console.error("Error loading signature:", error)
    }
  }

  const loadCheckInStatus = async () => {
    try {
      const res = await fetch(`/api/employee/jobs/${id}/check-in`)
      if (res.ok) {
        const data = await res.json()
        const checkedIn = !!data?.hasCheckedIn || data?.checkIns?.some((c: any) => c.type === "check_in")
        setIsCheckedIn(checkedIn)
      }
    } catch (error) {
      console.error("Error loading check-in status:", error)
    }
  }

  const openPhotoModal = (task?: Task) => {
    if (!isCheckedIn) {
      toast.error("Check in before uploading photos.")
      return
    }
    setSelectedTask(task || null)
    setPhotoModalOpen(true)
  }

  const handlePhotoUploaded = (photo: VerificationPhoto) => {
    setJobPhotos(prev => [photo, ...prev])
  }

  const handleSignatureSaved = () => {
    setHasSignature(true)
  }

  const getTaskPhotos = (taskId: number) => {
    return jobPhotos.filter(p => (p as any).taskId === taskId)
  }

  const updateJobStatus = async (action: "start" | "complete" | "pause") => {
    setUpdating(true)
    try {
      const res = await fetch(`/api/employee/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()

      if (res.ok) {
        setJob(prev => prev  ? { ...prev, ...data } : null)
        
        const messages = {
          start: "Job started! Good luck!",
          complete: "Job completed successfully!",
          pause: "Job paused",
        }
        toast.success(messages[action])
      } else {
        // Show specific error message from server
        if (data.incompleteTasks && data.incompleteTasks.length > 0) {
          toast.error(data.error, {
            description: `Incomplete: ${data.incompleteTasks.slice(0, 3).join(", ")}${data.incompleteTasks.length > 3  ? "..." : ""}`,
            duration: 5000,
          })
        } else {
          toast.error(data.error || "Failed to update job")
        }
      }
    } catch (error) {
      console.error("Error updating job:", error)
      toast.error("Failed to update job")
    } finally {
      setUpdating(false)
    }
  }

  const handleStartJob = () => {
    setStartAfterCheckIn(true)
    setCheckInTrigger((prev) => prev + 1)
  }

  const handleCompleteJob = () => {
    setCompleteAfterCheckOut(true)
    setCheckOutTrigger((prev) => prev + 1)
  }

  
  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/employee/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      })

      if (res.ok) {
        toast.success("Notes saved")
      } else {
        toast.error("Failed to save notes")
      }
    } catch (error) {
      console.error("Error saving notes:", error)
      toast.error("Failed to save notes")
    } finally {
      setSavingNotes(false)
    }
  }

  const toggleTask = async (task: Task) => {
    if (!isCheckedIn) {
      toast.error("Check in before updating tasks.")
      return
    }
    try {
      const res = await fetch(`/api/employee/jobs/${id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: task.status !== "completed" }),
      })

      if (res.ok) {
        setJob(prev => {
          if (!prev) return null
          return {
            ...prev,
            tasks: prev.tasks.map(t => 
              t.id === task.id 
                 ? { ...t, status: t.status === "completed"  ? "pending" : "completed" }
                : t
            ),
          }
        })
      }
    } catch (error) {
      console.error("Error toggling task:", error)
      toast.error("Failed to update task")
    }
  }

  const normalizeAddressPart = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "")

  const getAddressLine = () => {
    if (!job) return ""
    return [job.location, job.addressLine2].filter(Boolean).join(", ")
  }

  const getTownPostcode = () => {
    if (!job) return ""
    const addressLine = getAddressLine()
    const normalizedAddress = normalizeAddressPart(addressLine)
    const parts: string[] = []
    if (job.city && !normalizedAddress.includes(normalizeAddressPart(job.city))) {
      parts.push(job.city)
    }
    if (job.postcode && !normalizedAddress.includes(normalizeAddressPart(job.postcode))) {
      parts.push(job.postcode)
    }
    return parts.join(", ")
  }

  const getMapAddress = () => {
    if (!job) return ""
    const addressLine = getAddressLine()
    const townPostcode = getTownPostcode()
    return [addressLine, townPostcode].filter(Boolean).join(", ")
  }

  const openMaps = () => {
    const address = getMapAddress()
    if (address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank")
    }
  }

  const handleAcceptJob = async () => {
    setAccepting(true)
    try {
      const res = await fetch(`/api/employee/jobs/${id}/accept`, {
        method: "POST",
      })
      const data = await res.json()
      if (res.ok) {
        setJob(prev => prev  ? { ...prev, ...data.job } : null)
        toast.success("Job accepted. The customer will be notified.")
      } else {
        toast.error(data.error || "Failed to accept job")
      }
    } catch (error) {
      toast.error("Failed to accept job")
    } finally {
      setAccepting(false)
    }
  }

  const handleDeclineJob = async () => {
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
      const res = await fetch(`/api/employee/jobs/${id}/accept`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      })
      if (res.ok) {
        toast.success("Job declined.")
        setDeclineDialogOpen(false)
        setDeclineReason("")
        setDeclineConfirm("")
        router.push("/employee")
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to decline job")
      }
    } catch (error) {
      toast.error("Failed to decline job")
    } finally {
      setDeclining(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-8">
        <p className="text-center text-muted-foreground">Job not found</p>
      </div>
    )
  }

  const completedTasks = job.tasks.filter(t => t.status === "completed").length
  const totalTasks = job.tasks.length
  const allTasksCompleted = totalTasks === 0 || completedTasks === totalTasks

  const isAccepted = job.employeeAccepted === 1
  const showPayDetails = job.employeePayType !== "salary"
  const hasInstructions = Boolean(
    job.accessInstructions || job.parkingInstructions || job.specialInstructions
  )

  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 space-y-6">
      {/* Decline Confirmation Dialog */}
      <AlertDialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Job</AlertDialogTitle>
            <AlertDialogDescription>
              This will notify the company and send the job to reassignment. <br />
              <span className="block mt-2">Please provide a reason and type <span className="font-mono font-bold">decline</span> to confirm.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining..."
              rows={3}
              disabled={declining}
              autoFocus
            />
            <input
              className="border rounded px-2 py-1 w-full"
              value={declineConfirm}
              onChange={(e) => setDeclineConfirm(e.target.value)}
              placeholder="Type 'decline' to confirm"
              disabled={declining}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={declining}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={declining || !declineReason.trim() || declineConfirm.trim().toLowerCase() !== "decline"}
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeclineJob}
            >
              {declining  ? "Declining..." : "Confirm Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 mt-1 flex items-center gap-2 rounded-full border-muted-foreground/20 bg-background/80 px-3 py-1.5 shadow-sm hover:bg-muted"
            asChild
          >
            <Link href="/employee">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Back to Dashboard</span>
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-3xl font-bold leading-tight">{job.title}</h1>
              {job.status === "scheduled" && !isAccepted && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => setDeclineDialogOpen(true)}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={handleAcceptJob}
                    disabled={accepting}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm bg-green-600 hover:bg-green-700 text-white"
                  >
                    {accepting  ? "Accepting..." : "Accept"}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge 
                variant={
                  job.status === "completed"  ? "default" :
                  job.status === "in_progress"  ? "secondary" :
                  "outline"
                }
                className={`${job.status === "completed"  ? "bg-green-600" : ""} shrink-0`}
              >
                {job.status.replace("_", " ")}
              </Badge>
              {job.priority && job.priority !== "normal" && (
                <Badge variant={job.priority === "high"  ? "destructive" : "outline"} className="shrink-0">
                  {job.priority} priority
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Distance to Job Indicator */}
      {job.status !== "completed" && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                  <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Distance to Job</p>
                  {locationLoading  ? (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm">Getting location...</span>
                    </div>
                  ) : locationError  ? (
                    <p className="text-sm text-red-500">{locationError}</p>
                  ) : distanceToJob !== null  ? (
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {distanceToJob < 1 
                         ? `${Math.round(distanceToJob * 1000)} m` 
                        : `${distanceToJob.toFixed(1)} km`}
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {distanceToJob < 0.1  ? "You're here!" : distanceToJob < 1  ? "Almost there" : "away"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Tap to check distance</p>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={getCleanerLocation}
                  disabled={locationLoading}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {locationLoading  ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Navigation className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Refresh</span>
                    </>
                  )}
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={openMaps}
                  className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Navigate</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
            {job.status === "scheduled" && isAccepted && (
              <Button onClick={handleStartJob} disabled={updating} className="w-full sm:w-auto">
                {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Start Job
              </Button>
            )}
            {job.status === "in_progress" && (
              <>
                <Button 
                  onClick={handleCompleteJob} 
                  disabled={updating || completedTasks < totalTasks}
                  title={completedTasks < totalTasks ? `Complete all ${totalTasks - completedTasks} remaining tasks first` : "Complete this job"}
                  className="w-full sm:w-auto"
                >
                  {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Complete Job
                </Button>
                {completedTasks < totalTasks && totalTasks > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({totalTasks - completedTasks} task{totalTasks - completedTasks !== 1 ? "s" : ""} remaining)
                  </span>
                )}
                <Button variant="outline" onClick={() => updateJobStatus("pause")} disabled={updating} className="w-full sm:w-auto">
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              </>
            )}
            {job.status === "paused" && (
              <Button onClick={() => updateJobStatus("start")} disabled={updating} className="w-full sm:w-auto">
                <Play className="mr-2 h-4 w-4" />
                Resume Job
              </Button>
            )}
            {job.status === "completed" && (
              <Badge variant="default" className="bg-green-600 text-lg py-2 px-4">
                <CheckCircle className="mr-2 h-5 w-5" />
                Job Completed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPS Check-in & Job Details Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* GPS Check-in */}
        <GPSCheckIn 
          jobId={parseInt(id)} 
          jobStatus={job.status}
          allTasksCompleted={allTasksCompleted}
          extraContent={(
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pen className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Customer Sign-off</h4>
                </div>
                {hasSignature ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Signed
                  </Badge>
                ) : (
                  <Badge variant="outline">Optional</Badge>
                )}
              </div>
              {hasSignature ? (
                <p className="text-sm text-muted-foreground">
                  Customer has signed off on this job
                </p>
              ) : job.status === "completed" ? (
                <p className="text-sm text-muted-foreground">
                  Job completed without signature
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Customer signature is optional for this job
                  </p>
                  <Button
                    onClick={() => setSignatureModalOpen(true)}
                    disabled={job.status === "scheduled"}
                    className="w-full"
                  >
                    <Pen className="h-4 w-4 mr-2" />
                    Get Customer Signature
                  </Button>
                </>
              )}
            </div>
          )}
          requestCheckIn={checkInTrigger}
          requestCheckOut={checkOutTrigger}
          onStatusChange={() => {
            loadJob()
            loadCheckInStatus()
          }}
          onCheckInCompleted={async () => {
            loadCheckInStatus()
            if (startAfterCheckIn) {
              setStartAfterCheckIn(false)
              await updateJobStatus("start")
              return
            }
            loadJob()
          }}
          onCheckOutCompleted={async () => {
            loadCheckInStatus()
            if (completeAfterCheckOut) {
              setCompleteAfterCheckOut(false)
              await updateJobStatus("complete")
              return
            }
            loadJob()
          }}
        />
        {/* Job Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <FileText className="h-5 w-5" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {job.description && (
              <div className="pb-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                <p className="text-sm">{job.description}</p>
              </div>
            )}

            {job.description && <Separator />}

            <div className="space-y-2 pt-1">
              {job.customer && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{job.customer.name}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {getMapAddress() ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getMapAddress()!)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {getAddressLine() || getMapAddress()}
                  </a>
                ) : (
                  <span>No address provided</span>
                )}
              </div>
              {getTownPostcode() && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 opacity-70" />
                  <span>{getTownPostcode()}</span>
                </div>
              )}

              {job.scheduledFor && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(job.scheduledFor), "EEEE, MMMM d, yyyy")}</span>
                </div>
              )}

              {job.scheduledFor && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(job.scheduledFor), "HH:mm")}
                    {job.scheduledEnd && ` - ${format(new Date(job.scheduledEnd), "HH:mm")}`}
                    {job.durationMinutes && ` (${job.durationMinutes} minutes)`}
                  </span>
                </div>
              )}

              {showPayDetails && job.employeePay && (
                <div className="flex items-center gap-3 text-sm">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Your pay: £{parseFloat(job.employeePay).toFixed(2)}</span>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium">Job Notes</h4>
                <p className="text-xs text-muted-foreground">Add any notes about this job</p>
              </div>
              <Textarea
                placeholder="Add notes here (e.g., issues encountered, special requests, etc.)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={job.status === "completed"}
              />
              <Button
                onClick={saveNotes}
                disabled={savingNotes || job.status === "completed"}
                variant="outline"
                size="sm"
              >
                {savingNotes ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Notes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={`grid gap-6 ${hasInstructions ? "lg:grid-cols-2 items-stretch" : ""}`}>
        {/* Property Instructions */}
        {hasInstructions && (
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Property Instructions
              </CardTitle>
              <CardDescription>Important information for this address</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-4">
                  {job.accessInstructions && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <DoorOpen className="h-4 w-4 text-blue-600" />
                        <h4 className="font-medium text-sm">Access Instructions</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.accessInstructions}</p>
                    </div>
                  )}
                  {job.parkingInstructions && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Car className="h-4 w-4 text-green-600" />
                        <h4 className="font-medium text-sm">Parking Instructions</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.parkingInstructions}</p>
                    </div>
                  )}
                  {job.specialInstructions && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-orange-600" />
                        <h4 className="font-medium text-sm">Special Instructions</h4>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.specialInstructions}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Verification Photos */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Image className="h-5 w-5" />
                  Verification Photos
                </CardTitle>
                <CardDescription>Photos taken during this job</CardDescription>
              </div>
              <Button
                onClick={() => openPhotoModal()}
                disabled={job.status === "completed" || !isCheckedIn}
              >
                <Camera className="h-4 w-4 mr-2" />
                Add Photo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-full flex flex-col">
            {jobPhotos.length === 0  ? (
              <div className="text-center py-4 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No verification photos yet</p>
                <p className="text-sm">Take photos to document your work</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {jobPhotos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.caption || "Job photo"}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-2">
                      <div className="text-white text-xs">
                        <p className="font-medium truncate">{photo.caption || "No caption"}</p>
                        <p className="opacity-75">
                          {format(new Date(photo.capturedAt), "MMM d, HH:mm")}
                        </p>
                        {photo.latitude && photo.longitude && (
                          <div className="flex items-center gap-1 text-green-400">
                            <MapPin className="h-3 w-3" />
                            <span>Location verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {photo.verificationStatus === "verified" && (
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

        {/* Tasks Checklist */}
        {job.tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Tasks Checklist</span>
                <Badge variant="outline">
                  {completedTasks}/{totalTasks} completed
                </Badge>
              </CardTitle>
              <CardDescription>Check off tasks as you complete them and take verification photos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {job.tasks.map((task) => {
                  const taskPhotos = getTaskPhotos(task.id)
                  return (
                    <div 
                      key={task.id} 
                      className={`p-3 rounded-lg border ${
                        task.status === "completed"  ? "bg-green-50 border-green-200" : "bg-background"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={task.status === "completed"}
                          onCheckedChange={() => toggleTask(task)}
                          disabled={job.status === "completed" || !isCheckedIn}
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${task.status === "completed"  ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPhotoModal(task)}
                          disabled={job.status === "completed" || !isCheckedIn}
                          className="shrink-0"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Photo
                          {taskPhotos.length > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 px-1">
                              {taskPhotos.length}
                            </Badge>
                          )}
                        </Button>
                      </div>
                      
                      {/* Task Photos Preview */}
                      {taskPhotos.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {taskPhotos.map((photo) => (
                              <div key={photo.id} className="relative shrink-0">
                                <img
                                  src={photo.thumbnailUrl || photo.url}
                                  alt={photo.caption || "Task photo"}
                                  className="h-16 w-16 object-cover rounded-md"
                                />
                                {photo.verificationStatus === "verified" && (
                                  <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                                    <CheckCircle className="h-3 w-3 text-white" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Photo Modal */}
      <VerificationPhotoModal
        open={photoModalOpen}
        onClose={() => {
          setPhotoModalOpen(false)
          setSelectedTask(null)
        }}
        jobId={parseInt(id)}
        taskId={selectedTask?.id}
        taskName={selectedTask?.title}
        onPhotoUploaded={handlePhotoUploaded}
        onTaskCompleted={(taskId) => {
          // Update the local job state to mark task as completed
          setJob(prev => {
            if (!prev) return prev
            return {
              ...prev,
              tasks: prev.tasks.map(t => 
                t.id === taskId 
                   ? { ...t, status: "completed", completedAt: new Date().toISOString() }
                  : t
              )
            }
          })
        }}
      />

      {/* Signature Modal */}
      <SignaturePadModal
        open={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        jobId={parseInt(id)}
        customerName={job?.customer?.name}
        onSignatureSaved={handleSignatureSaved}
      />
      </main>
    </div>
  )
}

