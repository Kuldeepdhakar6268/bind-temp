"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Bell } from "lucide-react"

interface Employee {
  id: number
  firstName: string
  lastName: string
  role: string | null
  email: string | null
}

interface AssignJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: number | null
  jobTitle: string
  currentAssignee: number | null
  onSuccess: () => void
}

export function AssignJobDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  currentAssignee,
  onSuccess,
}: AssignJobDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [teamMembers, setTeamMembers] = useState("")
  const [sendNotification, setSendNotification] = useState(true)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [error, setError] = useState("")

  // Fetch employees
  useEffect(() => {
    if (open) {
      fetchEmployees()
      setSelectedEmployee(currentAssignee?.toString() || "")
      setNotes("")
    }
  }, [open, currentAssignee])

  const fetchEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const response = await fetch("/api/employees")
      if (!response.ok) throw new Error("Failed to fetch employees")
      const data = await response.json()
      setEmployees(data)
    } catch (err) {
      console.error("Failed to fetch employees:", err)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleSubmit = async () => {
    if (!jobId || !selectedEmployee) {
      setError("Please select an employee")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/jobs/${jobId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: parseInt(selectedEmployee),
          teamMembers: teamMembers || null,
          sendNotification,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to assign job")
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign job")
    } finally {
      setLoading(false)
    }
  }

  const selectedEmployeeData = employees.find((e) => e.id.toString() === selectedEmployee)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Assign Job
          </DialogTitle>
          <DialogDescription>
            Assign "{jobTitle}" to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Assign to</Label>
            {loadingEmployees ? (
              <div className="flex items-center gap-2 p-3 border rounded-md text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading employees...
              </div>
            ) : (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                          {employee.firstName.charAt(0)}
                          {employee.lastName.charAt(0)}
                        </div>
                        <span>
                          {employee.firstName} {employee.lastName}
                        </span>
                        {employee.role && (
                          <span className="text-gray-500 text-xs">({employee.role})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Employee Info */}
          {selectedEmployeeData && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                  {selectedEmployeeData.firstName.charAt(0)}
                  {selectedEmployeeData.lastName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">
                    {selectedEmployeeData.firstName} {selectedEmployeeData.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedEmployeeData.email || "No email"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Team Members (optional) */}
          <div className="space-y-2">
            <Label>Additional Team Members (optional)</Label>
            <Textarea
              value={teamMembers}
              onChange={(e) => setTeamMembers(e.target.value)}
              placeholder="Enter names of additional team members, separated by commas"
              rows={2}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Assignment Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions for this assignment..."
              rows={3}
            />
          </div>

          {/* Send Notification */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <div>
                <Label>Send notification email</Label>
                <p className="text-sm text-gray-500">
                  Notify the employee about this assignment
                </p>
              </div>
            </div>
            <Switch
              checked={sendNotification}
              onCheckedChange={setSendNotification}
            />
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedEmployee}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              "Assign Job"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
