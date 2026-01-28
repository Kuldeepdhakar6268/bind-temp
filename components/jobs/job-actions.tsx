"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MoreVertical,
  Edit,
  Trash2,
  User,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  Copy,
  Mail,
  Bell,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface Job {
  id: number
  title: string
  status: string
  assignedTo: number | null
  scheduledFor: string | null
}

interface JobActionsProps {
  job: Job
  onEdit?: () => void
  onDelete?: () => void
  onAssign?: () => void
  onRefresh?: () => void
}

export function JobActions({ job, onEdit, onDelete, onAssign, onRefresh }: JobActionsProps) {
  const [loading, setLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")

  const handleAction = async (
    action: string,
    endpoint: string,
    method: string = "POST",
    body?: any,
    successMessage?: string
  ) => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action}`)
      }

      toast.success(successMessage || `Job ${action} successfully`)
      onRefresh?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = () => {
    handleAction("start", `/api/jobs/${job.id}/start`, "POST", {}, "Job started!")
  }

  const handleComplete = () => {
    handleAction("complete", `/api/jobs/${job.id}/complete`, "POST", {}, "Job completed!")
  }

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation")
      return
    }
    handleAction(
      "cancel",
      `/api/jobs/${job.id}/cancel`,
      "POST",
      { reason: cancelReason },
      "Job cancelled"
    )
    setCancelDialogOpen(false)
    setCancelReason("")
  }

  const handleReschedule = () => {
    if (!newDate) {
      toast.error("Please select a new date")
      return
    }
    const dateTime = newTime
      ? new Date(`${newDate}T${newTime}`)
      : new Date(newDate)

    handleAction(
      "reschedule",
      `/api/jobs/${job.id}/reschedule`,
      "POST",
      { newDate: dateTime.toISOString() },
      "Job rescheduled"
    )
    setRescheduleDialogOpen(false)
    setNewDate("")
    setNewTime("")
  }

  const handleDuplicate = () => {
    handleAction(
      "duplicate",
      `/api/jobs/${job.id}/duplicate`,
      "POST",
      {},
      "Job duplicated"
    )
  }

  const handleSendConfirmation = () => {
    handleAction(
      "send confirmation",
      `/api/jobs/${job.id}/send-confirmation`,
      "POST",
      {},
      "Confirmation email sent"
    )
  }

  const handleSendReminder = () => {
    handleAction(
      "send reminder",
      `/api/jobs/${job.id}/send-reminder`,
      "POST",
      {},
      "Reminder email sent"
    )
  }

  const canStart = job.status === "scheduled" && job.assignedTo
  const canComplete = job.status === "in-progress"
  const canCancel = job.status !== "completed" && job.status !== "cancelled"
  const canReschedule = job.status !== "completed" && job.status !== "cancelled"
  const canDelete = true
  const canAssign = job.status !== "completed"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Edit */}
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Job
          </DropdownMenuItem>

          {/* Assign */}
          <DropdownMenuItem
            onClick={() => {
              if (!canAssign) {
                toast.error("Use Edit Job to change the cleaner on completed jobs")
                return
              }
              onAssign?.()
            }}
            disabled={!canAssign}
          >
            <User className="mr-2 h-4 w-4" />
            {job.assignedTo ? "Reassign" : "Assign"} Employee
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Status Actions */}
          {canStart && (
            <DropdownMenuItem onClick={handleStart}>
              <Play className="mr-2 h-4 w-4 text-green-600" />
              Start Job
            </DropdownMenuItem>
          )}

          {canComplete && (
            <DropdownMenuItem onClick={handleComplete}>
              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
              Mark Complete
            </DropdownMenuItem>
          )}

          {canReschedule && (
            <DropdownMenuItem onClick={() => setRescheduleDialogOpen(true)}>
              <Calendar className="mr-2 h-4 w-4 text-orange-600" />
              Reschedule
            </DropdownMenuItem>
          )}

          {canCancel && (
            <DropdownMenuItem onClick={() => setCancelDialogOpen(true)}>
              <XCircle className="mr-2 h-4 w-4 text-red-600" />
              Cancel Job
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Notifications */}
          <DropdownMenuItem onClick={handleSendConfirmation}>
            <Mail className="mr-2 h-4 w-4" />
            Send Confirmation
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleSendReminder} disabled={!job.scheduledFor}>
            <Bell className="mr-2 h-4 w-4" />
            Send Reminder
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Other Actions */}
          <DropdownMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate Job
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href={`/job/${job.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View Public Page
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Delete */}
          <DropdownMenuItem
            onClick={() => {
              onDelete?.()
            }}
            className="text-red-600"
            disabled={!canDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel "{job.title}"? This will notify the customer and assigned employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">Reason for cancellation</Label>
            <Textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter the reason for cancellation..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Job</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <AlertDialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule Job</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a new date and time for "{job.title}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="newDate">New Date</Label>
              <Input
                id="newDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="newTime">New Time (optional)</Label>
              <Input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReschedule}>
              Reschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
