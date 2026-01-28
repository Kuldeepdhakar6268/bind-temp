"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, MapPin, Clock, Smartphone, X, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface VerificationPhotoModalProps {
  open: boolean
  onClose: () => void
  jobId: number
  taskId?: number
  taskName?: string
  onPhotoUploaded: (photo: VerificationPhoto) => void
  onTaskCompleted?: (taskId: number) => void
}

interface VerificationPhoto {
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

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  address?: string
}

interface DeviceInfo {
  deviceType: string
  deviceModel: string
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent
  let deviceType = "unknown"
  let deviceModel = "unknown"

  if (/iPhone/.test(ua)) {
    deviceType = "iPhone"
    const match = ua.match(/iPhone OS (\d+_\d+)/)
    deviceModel = match ? `iOS ${match[1].replace("_", ".")}` : "iOS"
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

export function VerificationPhotoModal({
  open,
  onClose,
  jobId,
  taskId,
  taskName,
  onPhotoUploaded,
  onTaskCompleted,
}: VerificationPhotoModalProps) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [completingWithoutPhoto, setCompletingWithoutPhoto] = useState(false)
  const [caption, setCaption] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const getLocation = useCallback(async () => {
    setLocationLoading(true)
    setLocationError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }

      // Try to get address via reverse geocoding (optional)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
        )
        if (response.ok) {
          const data = await response.json()
          locationData.address = data.display_name
        }
      } catch (e) {
        // Address lookup failed, that's okay
        console.log("Could not get address:", e)
      }

      setLocation(locationData)
      toast.success("Location captured")
    } catch (error) {
      const geoError = error as GeolocationPositionError
      let message = "Could not get location"
      if (geoError.code === 1) {
        message = "Location permission denied. Please enable location access."
      } else if (geoError.code === 2) {
        message = "Location unavailable. Please try again."
      } else if (geoError.code === 3) {
        message = "Location request timed out. Please try again."
      }
      setLocationError(message)
      toast.error(message)
    } finally {
      setLocationLoading(false)
    }
  }, [])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      })
      setStream(mediaStream)
      setCameraActive(true)
      
      // Wait for next tick then set video source and play
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play().catch(console.error)
        }
      }, 100)

      // Auto-get location when camera starts
      if (!location) {
        getLocation()
      }
    } catch (error) {
      console.error("Camera access error:", error)
      toast.error("Could not access camera. Please check permissions.")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        setPhoto(file)
        setPhotoPreview(canvas.toDataURL("image/jpeg"))
        stopCamera()
      }
    }, "image/jpeg", 0.8)
  }

  const uploadPhoto = async () => {
    if (!photo) {
      toast.error("Please take or select a photo")
      return
    }

    setUploading(true)

    try {
      const deviceInfo = getDeviceInfo()
      const formData = new FormData()
      formData.append("photo", photo)
      if (taskId) formData.append("taskId", taskId.toString())
      if (location) {
        formData.append("latitude", location.latitude.toString())
        formData.append("longitude", location.longitude.toString())
        formData.append("locationAccuracy", location.accuracy.toString())
        if (location.address) {
          formData.append("capturedAddress", location.address)
        }
      }
      formData.append("deviceType", deviceInfo.deviceType)
      formData.append("deviceModel", deviceInfo.deviceModel)
      if (caption) formData.append("caption", caption)

      const response = await fetch(`/api/employee/jobs/${jobId}/photos`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to upload photo")
      }

      const data = await response.json()
      
      // If this photo is for a task, mark the task as completed
      if (taskId) {
        try {
          const taskResponse = await fetch(`/api/employee/jobs/${jobId}/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          })
          
          if (taskResponse.ok) {
            onTaskCompleted?.(taskId)
            toast.success("Photo saved and task marked as completed!")
          } else {
            toast.success("Photo saved! (Task update failed)")
          }
        } catch (taskError) {
          console.error("Task update error:", taskError)
          toast.success("Photo saved! (Task update failed)")
        }
      } else {
        toast.success("Photo uploaded successfully!")
      }
      
      onPhotoUploaded(data.photo)
      handleClose()
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to upload photo")
    } finally {
      setUploading(false)
    }
  }

  const markTaskCompleteWithoutPhoto = async () => {
    if (!taskId) return
    setCompletingWithoutPhoto(true)
    try {
      const taskResponse = await fetch(`/api/employee/jobs/${jobId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })

      if (!taskResponse.ok) {
        const data = await taskResponse.json().catch(() => null)
        throw new Error(data?.error || "Failed to mark task as completed")
      }

      onTaskCompleted?.(taskId)
      toast.success("Task marked as completed (no photo).")
      handleClose()
    } catch (error) {
      console.error("Task update error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to mark task as completed")
    } finally {
      setCompletingWithoutPhoto(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    setPhoto(null)
    setPhotoPreview(null)
    setLocation(null)
    setLocationError(null)
    setCaption("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Verification Photo
          </DialogTitle>
          <DialogDescription>
            {taskName
              ? `Take a photo to verify completion of: ${taskName} (optional)`
              : "Take a photo to verify your work (optional)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera / Photo Preview Section */}
          {cameraActive ? (
            <div className="relative overflow-hidden rounded-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-56 w-full bg-black object-cover sm:h-64"
                style={{ transform: 'scaleX(1)' }}
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button onClick={capturePhoto} size="lg" className="rounded-full">
                  <Camera className="h-6 w-6" />
                </Button>
                <Button onClick={stopCamera} variant="outline" size="lg" className="rounded-full">
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>
          ) : photoPreview ? (
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={photoPreview}
                alt="Preview"
                className="h-56 w-full object-cover sm:h-64"
              />
              <Button
                onClick={() => {
                  setPhoto(null)
                  setPhotoPreview(null)
                }}
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <Camera className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Take a photo to verify completion
                </p>
                <Button onClick={startCamera}>
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo
                </Button>
              </div>
            </div>
          )}



          {/* Location Status */}
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">Location</span>
              </div>
              {locationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : location ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : locationError ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={getLocation}
                >
                  Get Location
                </Button>
              )}
            </div>
            {location && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {location.address || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`}
                <span className="text-muted-foreground/70 ml-1">
                  (±{Math.round(location.accuracy)}m)
                </span>
              </p>
            )}
            {locationError && (
              <p className="text-xs text-red-500 mt-1">{locationError}</p>
            )}
          </div>

          {/* Timestamp */}
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Timestamp</span>
              <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().toLocaleString()}
            </p>
          </div>

          {/* Device Info */}
          <div className="p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="text-sm font-medium">Device</span>
              <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {getDeviceInfo().deviceType} - {getDeviceInfo().deviceModel}
            </p>
          </div>

          {/* Caption (optional) */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input
              id="caption"
              placeholder="Add a note about this photo..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          {/* Upload Button */}
          <Button
            onClick={uploadPhoto}
            className="w-full"
            disabled={!photo || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Verification Photo
              </>
            )}
          </Button>
          {taskId && (
            <Button
              variant="outline"
              onClick={markTaskCompleteWithoutPhoto}
              className="w-full"
              disabled={uploading || completingWithoutPhoto}
            >
              {completingWithoutPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Marking complete...
                </>
              ) : (
                "Mark task complete (no photo)"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
