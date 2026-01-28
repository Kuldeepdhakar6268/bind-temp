"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, MoreVertical, Trash2, XCircle } from "lucide-react"
import { toast } from "sonner"

interface JobCornerActionsProps {
  jobId: number
  title: string
  status?: string | null
  onRefresh?: () => void
  align?: "start" | "end"
}

export function JobCornerActions({ jobId, title, status, onRefresh, align = "end" }: JobCornerActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [submitting, setSubmitting] = useState<"cancel" | "delete" | null>(null)

  const canCancel = status !== "completed" && status !== "cancelled"
  const canDelete = true

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation")
      return
    }
    setSubmitting("cancel")
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to cancel job")
      }
      toast.success("Job cancelled")
      setCancelReason("")
      setCancelDialogOpen(false)
      onRefresh?.()
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel job")
    } finally {
      setSubmitting(null)
    }
  }

  const handleDelete = async () => {
    setSubmitting("delete")
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete job")
      }
      toast.success("Job deleted")
      setDeleteDialogOpen(false)
      onRefresh?.()
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={submitting !== null}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          <DropdownMenuItem onClick={() => setCancelDialogOpen(true)} disabled={!canCancel}>
            <XCircle className="mr-2 h-4 w-4 text-red-600" />
            Cancel Job
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel "{title}"? This will notify the customer and assigned employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor={`cancel-reason-${jobId}`}>Reason for cancellation</Label>
            <Textarea
              id={`cancel-reason-${jobId}`}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter the reason for cancellation..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting === "cancel"}>Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
              disabled={submitting === "cancel"}
            >
              {submitting === "cancel" ? "Cancelling..." : "Cancel Job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{title}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={submitting === "delete"}
            >
              {submitting === "delete" ? "Deleting..." : "Delete Job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
