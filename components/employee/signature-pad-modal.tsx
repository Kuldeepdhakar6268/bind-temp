"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Loader2, Pen, RotateCcw, Star, CheckCircle } from "lucide-react"

interface SignaturePadModalProps {
  open: boolean
  onClose: () => void
  jobId: number
  customerName?: string
  onSignatureSaved: (signature: any) => void
}

export function SignaturePadModal({
  open,
  onClose,
  jobId,
  customerName,
  onSignatureSaved,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [signerName, setSignerName] = useState(customerName || "")
  const [signerEmail, setSignerEmail] = useState("")
  const [rating, setRating] = useState<number>(5)
  const [feedback, setFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null)

  // Get location when modal opens
  useEffect(() => {
    if (open) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
          // Try reverse geocoding
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
            )
            if (response.ok) {
              const data = await response.json()
              setLocation({ ...loc, address: data.display_name })
            } else {
              setLocation(loc)
            }
          } catch {
            setLocation(loc)
          }
        },
        () => {
          // Location not available, that's okay
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [open])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Set drawing style
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Fill with white background
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [open])

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return

    const coords = getCoordinates(e)
    if (!coords) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const getSignatureData = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL("image/png")
  }

  const handleSubmit = async () => {
    if (!hasSignature) {
      toast.error("Please provide a signature")
      return
    }

    if (!signerName.trim()) {
      toast.error("Please enter signer name")
      return
    }

    setSubmitting(true)

    try {
      const signatureData = getSignatureData()

      const res = await fetch(`/api/employee/jobs/${jobId}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureData,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim() || null,
          rating,
          feedback: feedback.trim() || null,
          latitude: location?.latitude?.toString(),
          longitude: location?.longitude?.toString(),
          signedAddress: location?.address,
          deviceType: /iPhone|iPad|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Signature saved successfully!")
        onSignatureSaved(data.signature)
        handleClose()
      } else {
        toast.error(data.error || "Failed to save signature")
      }
    } catch (error) {
      console.error("Error saving signature:", error)
      toast.error("Failed to save signature")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    clearSignature()
    setSignerName(customerName || "")
    setSignerEmail("")
    setRating(5)
    setFeedback("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pen className="h-5 w-5" />
            Customer Sign-Off
          </DialogTitle>
          <DialogDescription>
            Get the customer's signature to confirm job completion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Signature Canvas */}
          <div>
            <Label>Signature</Label>
            <div className="relative mt-1">
              <canvas
                ref={canvasRef}
                className="w-full h-40 border rounded-lg cursor-crosshair touch-none bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground">
                  <p className="text-sm">Sign here</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSignature}
              className="mt-1"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>

          {/* Signer Name */}
          <div className="space-y-2">
            <Label htmlFor="signerName">Full Name *</Label>
            <Input
              id="signerName"
              placeholder="Customer's full name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          {/* Signer Email (optional) */}
          <div className="space-y-2">
            <Label htmlFor="signerEmail">Email (optional)</Label>
            <Input
              id="signerEmail"
              type="email"
              placeholder="Customer's email for receipt"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
            />
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback (optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Any comments about the service?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !hasSignature || !signerName.trim()}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm & Save Signature
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
