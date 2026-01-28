"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { toast } from "sonner"
import {
  MapPin,
  LogIn,
  LogOut,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  Navigation,
  AlertTriangle,
  Lock,
} from "lucide-react"

interface GPSCheckInProps {
  jobId: number
  jobStatus: string
  allTasksCompleted?: boolean
  onStatusChange?: () => void
  requestCheckIn?: number
  onCheckInCompleted?: () => void
  requestCheckOut?: number
  onCheckOutCompleted?: () => void
  extraContent?: ReactNode
}

interface CheckInStatus {
  status: "not_checked_in" | "checked_in" | "checked_out"
  lastCheckIn: any | null
  lastCheckOut: any | null
  totalTimeOnSite: number
  checkIns: any[]
  hasCheckedIn?: boolean
  hasCheckedOut?: boolean
  jobDuration?: number // duration in minutes
}

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  address?: string
}

function getDeviceInfo() {
  const ua = navigator.userAgent
  let deviceType = "unknown"
  let deviceModel = "unknown"

  if (/iPhone/.test(ua)) {
    deviceType = "iPhone"
    deviceModel = "iOS"
  } else if (/iPad/.test(ua)) {
    deviceType = "iPad"
    deviceModel = "iPadOS"
  } else if (/Android/.test(ua)) {
    deviceType = "Android"
    const match = ua.match(/Android (\d+\.?\d*)/)
    deviceModel = match ? `Android ${match[1]}` : "Android"
  } else if (/Windows/.test(ua)) {
    deviceType = "Windows"
    deviceModel = "Desktop"
  } else if (/Mac/.test(ua)) {
    deviceType = "Mac"
    deviceModel = "Desktop"
  }

  return { deviceType, deviceModel }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export function GPSCheckIn({
  jobId,
  jobStatus,
  allTasksCompleted = false,
  onStatusChange,
  requestCheckIn,
  onCheckInCompleted,
  requestCheckOut,
  onCheckOutCompleted,
  extraContent,
}: GPSCheckInProps) {
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<"check_in" | "check_out" | null>(null)
  const [checkoutComment, setCheckoutComment] = useState("")

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/employee/jobs/${jobId}/check-in`)
      if (res.ok) {
        const data = await res.json()
        setCheckInStatus(data)
      }
    } catch (error) {
      console.error("Error fetching check-in status:", error)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Handle requestCheckIn prop to trigger check-in dialog
  useEffect(() => {
    if (!requestCheckIn) return
    // Only open dialog if we're not loading and can check in
    if (loading) return
    
    const hasAlreadyCheckedIn = checkInStatus?.hasCheckedIn || checkInStatus?.checkIns?.some((c: any) => c.type === "check_in")
    const jobCompleted = jobStatus === "completed"
    const canDoCheckIn = !hasAlreadyCheckedIn && !jobCompleted
    
    if (!canDoCheckIn) {
      toast.error("Check-in not available for this job.")
      return
    }
    setPendingAction("check_in")
    setConfirmDialogOpen(true)
  }, [requestCheckIn, loading, checkInStatus, jobStatus])

  // Handle requestCheckOut prop to trigger check-out dialog
  useEffect(() => {
    if (!requestCheckOut) return
    // Only open dialog if we're not loading and can check out
    if (loading) return
    
    const hasAlreadyCheckedIn = checkInStatus?.hasCheckedIn || checkInStatus?.checkIns?.some((c: any) => c.type === "check_in")
    const hasAlreadyCheckedOut = checkInStatus?.hasCheckedOut || checkInStatus?.checkIns?.some((c: any) => c.type === "check_out")
    const jobCompleted = jobStatus === "completed"
    const canDoCheckOut = hasAlreadyCheckedIn && !hasAlreadyCheckedOut && !jobCompleted
    
    if (!canDoCheckOut) {
      if (!hasAlreadyCheckedIn) {
        toast.error("Please check in first before completing the job.")
      } else if (hasAlreadyCheckedOut) {
        toast.error("Already checked out from this job.")
      } else {
        toast.error("Check-out not available for this job.")
      }
      return
    }
    setCheckoutComment("")
    setPendingAction("check_out")
    setConfirmDialogOpen(true)
  }, [requestCheckOut, loading, checkInStatus, jobStatus])

  const getLocation = async (): Promise<LocationData | null> => {
    setLocationLoading(true)
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser")
      setLocationLoading(false)
      return {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        address: "Location unavailable - GPS not supported",
      }
    }
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000, // Increased timeout to 30 seconds
          maximumAge: 60000, // Accept cached location up to 1 minute old
        })
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }

      // Try reverse geocoding (but don't fail if it doesn't work)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
          { signal: AbortSignal.timeout(5000) } // 5 second timeout for geocoding
        )
        if (response.ok) {
          const data = await response.json()
          locationData.address = data.display_name
        }
      } catch (e) {
        console.log("Could not get address:", e)
        locationData.address = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
      }

      setLocation(locationData)
      return locationData
    } catch (error) {
      const geoError = error as GeolocationPositionError
      let message = "Could not get location"
      
      if (geoError.code === 1) {
        message = "Location permission denied. Please enable location access in your browser settings."
      } else if (geoError.code === 2) {
        message = "Location unavailable. Please ensure GPS is enabled."
      } else if (geoError.code === 3) {
        message = "Location request timed out. Proceeding without precise location."
      }
      
      toast.error(message)
      
      // For timeout errors, still allow check-in with a note
      if (geoError.code === 3) {
        return {
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          address: "Location timed out - GPS unavailable"
        }
      }
      
      const fallbackAddress = message
        ? `Location unavailable - ${message}`
        : "Location unavailable"
      return {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        address: fallbackAddress,
      }
    } finally {
      setLocationLoading(false)
    }
  }

  const handleCheckIn = async (type: "check_in" | "check_out") => {
    // Show confirmation dialog first
    if (type === "check_out") {
      setCheckoutComment("")
    }
    setPendingAction(type)
    setConfirmDialogOpen(true)
  }

  const confirmCheckIn = async () => {
    if (!pendingAction) return
    
    setConfirmDialogOpen(false)
    setSubmitting(true)
    
    toast.info("Getting your location...", { duration: 2000 })

    // Get current location
    const locationData = await getLocation()
    if (!locationData) {
      toast.error("Could not proceed without location. Please enable GPS and try again.")
      setSubmitting(false)
      setPendingAction(null)
      return
    }

    toast.info("Recording check-in...", { duration: 2000 })

    try {
      const deviceInfo = getDeviceInfo()
      const res = await fetch(`/api/employee/jobs/${jobId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: pendingAction,
          latitude: locationData.latitude.toString(),
          longitude: locationData.longitude.toString(),
          locationAccuracy: locationData.accuracy.toString(),
          capturedAddress: locationData.address,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,
          comment: pendingAction === "check_out" ? checkoutComment.trim() : null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(data.message)
        fetchStatus()
        onStatusChange?.()
        if (pendingAction === "check_in") {
          onCheckInCompleted?.()
        } else if (pendingAction === "check_out") {
          onCheckOutCompleted?.()
          setCheckoutComment("")
        }
      } else {
        toast.error(data.error || "Failed to check in")
      }
    } catch (error) {
      console.error("Check-in error:", error)
      toast.error("Failed to check in")
    } finally {
      setSubmitting(false)
      setPendingAction(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Determine if user has already checked in or out (one-time actions)
  const hasCheckedIn = checkInStatus?.hasCheckedIn || checkInStatus?.checkIns?.some((c: any) => c.type === "check_in")
  const hasCheckedOut = checkInStatus?.hasCheckedOut || checkInStatus?.checkIns?.some((c: any) => c.type === "check_out")
  
  const isCheckedIn = checkInStatus?.status === "checked_in"
  const isCheckedOut = checkInStatus?.status === "checked_out"
  
  // Can only check in ONCE and only if not already checked in
  const canCheckIn = !hasCheckedIn && jobStatus !== "completed"
  
  // Can only check out ONCE, only if checked in, and only if all tasks are completed
  const canCheckOut = hasCheckedIn && !hasCheckedOut && allTasksCompleted && jobStatus !== "completed"
  
  // Show why checkout is disabled
  const checkoutDisabledReason = hasCheckedIn && !hasCheckedOut && !allTasksCompleted 
    ? "Complete all tasks before checking out" 
    : null

  return (
    <>
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm {pendingAction === "check_in" ? "Check In" : "Check Out"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
              {pendingAction === "check_in" ? (
                <>
                  <p>You are about to check in to this job site.</p>
                  <p className="font-semibold text-amber-600">
                    This action is irreversible. You can only check in once per job.
                  </p>
                  <p>Your current GPS location will be recorded.</p>
                </>
              ) : (
                <>
                  <p>You are about to check out from this job site.</p>
                  <p className="font-semibold text-amber-600">
                    This action is irreversible. You cannot undo this check out.
                  </p>
                  <p>Your check-out time and location will be recorded, and the job duration will be calculated.</p>
                  <div className="pt-2 space-y-2">
                    <Label htmlFor="checkoutComment" className="text-sm text-foreground">Comment (optional)</Label>
                    <Textarea
                      id="checkoutComment"
                      value={checkoutComment}
                      onChange={(e) => setCheckoutComment(e.target.value)}
                      placeholder="Add a note about anything that needs fixing or went wrong..."
                      className="min-h-[90px] text-sm text-foreground"
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground">This note will be shared with your manager.</p>
                  </div>
                </>
              )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingAction(null)
              setCheckoutComment("")
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCheckIn}
              className={pendingAction === "check_in" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {pendingAction === "check_in" ? "Yes, Check In" : "Yes, Check Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <h3 className="font-semibold truncate">GPS Check-in</h3>
            </div>
            <Badge
              variant={isCheckedIn ? "default" : isCheckedOut ? "secondary" : "outline"}
              className={`shrink-0 ${isCheckedIn ? "bg-green-600" : ""}`}
            >
              {isCheckedIn ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  On Site
                </>
              ) : isCheckedOut ? (
                "Completed"
              ) : (
                "Not Arrived"
              )}
            </Badge>
          </div>

          {/* Job Duration - shown when checked out */}
          {isCheckedOut && checkInStatus?.jobDuration && (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 mb-4 p-2 bg-green-50 rounded-lg overflow-hidden">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="truncate">Total Job Duration: {formatDuration(checkInStatus.jobDuration)}</span>
            </div>
          )}

          {/* Time on site - shown while checked in */}
          {isCheckedIn && checkInStatus && checkInStatus.totalTimeOnSite > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Clock className="h-4 w-4" />
              <span>Time on site: {formatDuration(checkInStatus.totalTimeOnSite)}</span>
            </div>
          )}

          {/* Last location */}
          {checkInStatus?.lastCheckIn && (
            <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded-lg overflow-hidden">
              <div className="flex items-start gap-2 min-w-0">
                <Navigation className="h-3 w-3 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Last check-in location:</p>
                  <p className="break-words text-[11px] leading-tight">{checkInStatus.lastCheckIn.capturedAddress || "Location captured"}</p>
                  <p className="text-muted-foreground/70 text-[10px]">
                    {new Date(checkInStatus.lastCheckIn.checkedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
          {checkInStatus?.lastCheckOut && (
            <div className="text-xs text-muted-foreground mb-4 p-2 bg-muted rounded-lg overflow-hidden">
              <div className="flex items-start gap-2 min-w-0">
                <LogOut className="h-3 w-3 mt-0.5 shrink-0 text-orange-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Last check-out:</p>
                  <p className="text-[11px] leading-tight">
                    {new Date(checkInStatus.lastCheckOut.checkedAt).toLocaleString()}
                  </p>
                  {checkInStatus.jobDuration && (
                    <p className="text-muted-foreground/70 text-[10px]">
                      Duration: {formatDuration(checkInStatus.jobDuration)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {canCheckIn && (
                <Button
                  onClick={() => handleCheckIn("check_in")}
                  disabled={submitting || locationLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {submitting || locationLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4 mr-2" />
                  )}
                  {locationLoading ? "Getting Location..." : "Check In"}
                </Button>
              )}

              {canCheckOut && (
                <Button
                  onClick={() => handleCheckIn("check_out")}
                  disabled={submitting || locationLoading}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  {submitting || locationLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  {locationLoading ? "Getting Location..." : "Check Out"}
                </Button>
              )}

              {/* Checkout locked - tasks not complete */}
              {checkoutDisabledReason && (
                <Button
                  disabled
                  variant="outline"
                  className="flex-1 opacity-50"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              )}

              {/* Already checked in - show disabled button */}
              {hasCheckedIn && !hasCheckedOut && !checkoutDisabledReason && !canCheckOut && !isCheckedOut && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Checked in</span>
                </div>
              )}

              {/* Job completed */}
              {(jobStatus === "completed" || isCheckedOut) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Job completed</span>
                </div>
              )}
            </div>

            {/* Warning message for locked checkout */}
            {checkoutDisabledReason && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{checkoutDisabledReason}</span>
              </div>
            )}
          </div>

          {extraContent && (
            <div className="mt-4 pt-4 border-t">
              {extraContent}
            </div>
          )}

        {/* Check-in history */}
        {checkInStatus && checkInStatus.checkIns.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Check-in History</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {checkInStatus.checkIns.slice(0, 6).map((checkIn: any) => (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    {checkIn.type === "check_in" ? (
                      <LogIn className="h-3 w-3 text-green-600" />
                    ) : (
                      <LogOut className="h-3 w-3 text-orange-500" />
                    )}
                    <span>{checkIn.type === "check_in" ? "Arrived" : "Left"}</span>
                  </div>
                  <span className="text-[11px] tabular-nums">{new Date(checkIn.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  )
}
