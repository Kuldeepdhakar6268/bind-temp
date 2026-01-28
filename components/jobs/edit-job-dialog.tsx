"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Job {
  id: number
  title: string
  description?: string | null
  customerId: number
  planId?: number | null
  assignedTo?: number | null
  location?: string | null
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
  accessInstructions?: string | null
  parkingInstructions?: string | null
  specialInstructions?: string | null
  scheduledFor?: string | null
  scheduledEnd?: string | null
  durationMinutes?: number | null
  recurrence?: string | null
  recurrenceEndDate?: string | null
  status: string
  priority?: string | null
  completedAt?: string | null
  estimatedPrice?: string | null
  actualPrice?: string | null
  currency?: string | null
  qualityRating?: string | null
  customerFeedback?: string | null
  internalNotes?: string | null
  assignments?: {
    employeeId: number
    payAmount: string | null
    status?: string | null
    employee?: { id: number; name: string; payType?: string | null } | null
  }[]
}

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  role?: string | null
  status: string
  payType?: string | null
  hourlyRate?: string | null
}

interface CleaningPlan {
  id: number
  name: string
  estimatedDuration?: string | null
  price?: string | null
  isActive?: number | null
}

interface EditJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: Job | null
  onSuccess?: () => void
}

export function EditJobDialog({ open, onOpenChange, job, onSuccess }: EditJobDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [plans, setPlans] = useState<CleaningPlan[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [assigneeConfirmOpen, setAssigneeConfirmOpen] = useState(false)
  const [assignedEmployees, setAssignedEmployees] = useState<number[]>([])
  const [assignmentPays, setAssignmentPays] = useState<Record<number, string>>({})
  const [assignmentPayOverrides, setAssignmentPayOverrides] = useState<Record<number, boolean>>({})
  const [initialAssignedEmployees, setInitialAssignedEmployees] = useState<number[]>([])
  const [availability, setAvailability] = useState<Record<number, "available" | "busy">>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customerId: "",
    planId: "",
    location: "",
    addressLine2: "",
    city: "",
    postcode: "",
    accessInstructions: "",
    parkingInstructions: "",
    specialInstructions: "",
    scheduledFor: "",
    scheduledEnd: "",
    durationMinutes: "60",
    recurrence: "none",
    recurrenceEndDate: "",
    status: "scheduled",
    priority: "normal",
    completedAt: "",
    estimatedPrice: "",
    actualPrice: "",
    currency: "GBP",
    qualityRating: "",
    customerFeedback: "",
    internalNotes: "",
  })

  // Load job data when dialog opens
  useEffect(() => {
    if (job) {
      const assignmentIds = job.assignments?.length
        ? job.assignments.map((assignment) => assignment.employeeId)
        : job.assignedTo
          ? [job.assignedTo]
          : []
      const payMap = (job.assignments || []).reduce<Record<number, string>>((acc, assignment) => {
        if (assignment.payAmount) {
          acc[assignment.employeeId] = assignment.payAmount
        }
        return acc
      }, {})
      const overrideMap = (job.assignments || []).reduce<Record<number, boolean>>((acc, assignment) => {
        if (assignment.payAmount) {
          acc[assignment.employeeId] = true
        }
        return acc
      }, {})

      setFormData({
        title: job.title || "",
        description: job.description || "",
        customerId: job.customerId?.toString() || "",
        planId: job.planId ? job.planId.toString() : "",
        location: job.location || "",
        addressLine2: job.addressLine2 || "",
        city: job.city || "",
        postcode: job.postcode || "",
        accessInstructions: job.accessInstructions || "",
        parkingInstructions: job.parkingInstructions || "",
        specialInstructions: job.specialInstructions || "",
        scheduledFor: job.scheduledFor ? job.scheduledFor.slice(0, 16) : "",
        scheduledEnd: job.scheduledEnd ? job.scheduledEnd.slice(0, 16) : "",
        durationMinutes: job.durationMinutes?.toString() || "60",
        recurrence: job.recurrence || "none",
        recurrenceEndDate: job.recurrenceEndDate ? job.recurrenceEndDate.split("T")[0] : "",
        status: job.status || "scheduled",
        priority: job.priority || "normal",
        completedAt: job.completedAt ? job.completedAt.slice(0, 16) : "",
        estimatedPrice: job.estimatedPrice || "",
        actualPrice: job.actualPrice || "",
        currency: job.currency || "GBP",
        qualityRating: job.qualityRating || "",
        customerFeedback: job.customerFeedback || "",
        internalNotes: job.internalNotes || "",
      })
      setAssignedEmployees(assignmentIds)
      setInitialAssignedEmployees(assignmentIds)
      setAssignmentPays(payMap)
      setAssignmentPayOverrides(overrideMap)
    }
  }, [job])

  useEffect(() => {
    if (!employees.length || assignedEmployees.length === 0) return
    setAssignmentPayOverrides((prev) => {
      const next = { ...prev }
      for (const employeeId of assignedEmployees) {
        const employee = employees.find((emp) => emp.id === employeeId)
        if (employee?.payType === "per_job") {
          next[employeeId] = true
        }
      }
      return next
    })
  }, [employees, assignedEmployees])

  // Load customers and employees
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  const fetchData = async () => {
    setLoadingData(true)
    try {
      const [customersRes, employeesRes, plansRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/employees?status=active"),
        fetch("/api/cleaning-plans"),
      ])

      if (customersRes.ok) {
        const customersData = await customersRes.json()
        setCustomers(customersData)
      }

      if (employeesRes.ok) {
        const employeesData = await employeesRes.json()
        setEmployees(employeesData)
      }
      if (plansRes.ok) {
        const plansData = await plansRes.json()
        setPlans(Array.isArray(plansData) ? plansData : [])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const toggleAssignedEmployee = (employeeId: number, checked: boolean) => {
    setAssignedEmployees((prev) => {
      if (checked) {
        return prev.includes(employeeId) ? prev : [...prev, employeeId]
      }
      return prev.filter((id) => id !== employeeId)
    })
    if (checked) {
      const employee = employees.find((emp) => emp.id === employeeId)
      const requiresPay = employee?.payType === "per_job"
      setAssignmentPayOverrides((prev) => ({ ...prev, [employeeId]: requiresPay }))
      if (requiresPay && !assignmentPays[employeeId]) {
        const suggested = getSuggestedPayForEmployee(employeeId)
        if (suggested > 0) {
          setAssignmentPays((prev) => ({ ...prev, [employeeId]: suggested.toFixed(2) }))
        }
      }
    } else {
      setAssignmentPayOverrides((prev) => {
        const next = { ...prev }
        delete next[employeeId]
        return next
      })
      setAssignmentPays((prev) => {
        const next = { ...prev }
        delete next[employeeId]
        return next
      })
    }
  }

  const updateAssignmentPay = (employeeId: number, value: string) => {
    setAssignmentPays((prev) => ({ ...prev, [employeeId]: value }))
  }

  const toggleAssignmentPayOverride = (employeeId: number, checked: boolean) => {
    setAssignmentPayOverrides((prev) => ({ ...prev, [employeeId]: checked }))
    if (!checked) {
      setAssignmentPays((prev) => {
        const next = { ...prev }
        delete next[employeeId]
        return next
      })
      return
    }
    if (!assignmentPays[employeeId]) {
      const suggested = getSuggestedPayForEmployee(employeeId)
      if (suggested > 0) {
        setAssignmentPays((prev) => ({ ...prev, [employeeId]: suggested.toFixed(2) }))
      }
    }
  }

  const getSuggestedPayForEmployee = (employeeId: number) => {
    const employee = employees.find((emp) => emp.id === employeeId)
    const rate = employee?.hourlyRate ? parseFloat(employee.hourlyRate) : 0
    const duration = parseFloat(formData.durationMinutes) || 0
    if (!Number.isFinite(rate) || rate <= 0 || !duration) return 0
    const hours = duration / 60
    return rate * hours
  }

  const getAssignedEmployeeIds = () => assignedEmployees

  const isCompletedAssigneeChange = () => {
    if (!job) return false
    if (job.status !== "completed") return false
    const current = [...assignedEmployees].sort((a, b) => a - b)
    const initial = [...initialAssignedEmployees].sort((a, b) => a - b)
    if (current.length !== initial.length) return true
    return current.some((id, idx) => id !== initial[idx])
  }

  const getEmployeeName = (id: number | null | undefined) => {
    if (!id) return "Unassigned"
    const employee = employees.find((emp) => emp.id === id)
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee #${id}`
  }

  const getEmployeeNames = (ids: number[]) => {
    if (!ids.length) return "Unassigned"
    return ids.map((id) => getEmployeeName(id)).join(", ")
  }

  useEffect(() => {
    if (!open || !employees.length || !formData.scheduledFor) {
      setAvailability({})
      return
    }

    const fetchAvailability = async () => {
      const start = new Date(formData.scheduledFor)
      if (Number.isNaN(start.getTime())) {
        setAvailability({})
        return
      }

      const durationMinutes = parseInt(formData.durationMinutes || "0", 10) || 0
      let end = formData.scheduledEnd ? new Date(formData.scheduledEnd) : null
      if (!end || Number.isNaN(end.getTime())) {
        end = durationMinutes > 0
          ? new Date(start.getTime() + durationMinutes * 60000)
          : new Date(start.getTime() + 60 * 60000)
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
          if (job && existingJob.id === job.id) continue
          if (!existingJob.scheduledFor || !acceptedStatuses.has(existingJob.status)) continue

          const assignedIds =
            existingJob.assignments?.map((assignment) => assignment.employeeId) ??
            (existingJob.assignedTo ? [existingJob.assignedTo] : [])
          if (assignedIds.length === 0) continue

          const jobStart = new Date(existingJob.scheduledFor)
          if (Number.isNaN(jobStart.getTime())) continue
          const jobDuration = existingJob.durationMinutes && existingJob.durationMinutes > 0 ? existingJob.durationMinutes : 60
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
  }, [open, employees, formData.scheduledFor, formData.scheduledEnd, formData.durationMinutes, job])

  const submitUpdate = async () => {
    if (!job) return

    setError("")
    setLoading(true)

    try {
      if (assignedEmployees.length === 0) {
        throw new Error("Please assign at least one employee")
      }
      for (const employeeId of assignedEmployees) {
        const employee = employees.find((emp) => emp.id === employeeId)
        const requiresPay = employee?.payType === "per_job"
        const wantsOverride = assignmentPayOverrides[employeeId]
        if ((requiresPay || wantsOverride) && !assignmentPays[employeeId]) {
          throw new Error(`Enter pay for ${employee.firstName} ${employee.lastName}`)
        }
      }
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          customerId: parseInt(formData.customerId),
          assignedTo: assignedEmployees[0] ?? null,
          assignedEmployees: assignedEmployees.map((employeeId) => ({
            employeeId,
            payAmount: assignmentPays[employeeId] || null,
          })),
          planId: formData.planId ? parseInt(formData.planId) : null,
          durationMinutes: parseInt(formData.durationMinutes),
          estimatedPrice: formData.estimatedPrice ? parseFloat(formData.estimatedPrice) : null,
          actualPrice: formData.actualPrice ? parseFloat(formData.actualPrice) : null,
          qualityRating: formData.qualityRating ? parseFloat(formData.qualityRating) : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update job")
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job) return
    if (isCompletedAssigneeChange()) {
      setAssigneeConfirmOpen(true)
      return
    }
    await submitUpdate()
  }

  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !w-screen !max-w-none !h-[100dvh] !max-h-[100dvh] !rounded-none !border-0 !p-0 overflow-hidden flex flex-col sm:!inset-auto sm:!top-[50%] sm:!left-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!w-[calc(100%-1.5rem)] sm:!max-w-4xl sm:!h-auto sm:!max-h-[90vh] sm:!rounded-lg sm:!border sm:!p-6">
        <DialogHeader className="space-y-1 border-b px-4 pt-4 pb-3 sm:border-0 sm:px-0 sm:pt-0 sm:pb-0">
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update job details, schedule, and completion information.
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-0 sm:pb-0">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="flex w-full gap-2 overflow-x-auto h-9 -mx-2 px-2 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:overflow-visible">
                  <TabsTrigger value="basic" className="text-[11px] sm:text-sm whitespace-nowrap flex-none sm:flex-1 px-3">
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="scheduling" className="text-[11px] sm:text-sm whitespace-nowrap flex-none sm:flex-1 px-3">
                    Scheduling
                  </TabsTrigger>
                  <TabsTrigger value="details" className="text-[11px] sm:text-sm whitespace-nowrap flex-none sm:flex-1 px-3">
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="completion" className="text-[11px] sm:text-sm whitespace-nowrap flex-none sm:flex-1 px-3">
                    Completion
                  </TabsTrigger>
                </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">
                    Job Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                    <Input
                      id="durationMinutes"
                      type="number"
                      min="15"
                      step="15"
                      value={formData.durationMinutes}
                      onChange={(e) => handleChange("durationMinutes", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="planId">Cleaning Plan</Label>
                  <Select value={formData.planId} onValueChange={(value) => handleChange("planId", value)}>
                    <SelectTrigger id="planId" className="w-full">
                      <SelectValue placeholder="Select cleaning plan (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => {
                        const isInactive = plan.isActive === 0
                        const isDisabled = isInactive && plan.id.toString() !== formData.planId
                        return (
                          <SelectItem key={plan.id} value={plan.id.toString()} disabled={isDisabled}>
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="block truncate">{plan.name}</span>
                              {isInactive && (
                                <span className="text-xs text-muted-foreground">(inactive)</span>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Inactive plans are frozen and cannot be selected.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2 min-w-0">
                    <Label htmlFor="customerId">
                      Customer <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.customerId} onValueChange={(value) => handleChange("customerId", value)}>
                      <SelectTrigger className="w-full overflow-hidden">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            <span className="block truncate">
                              {customer.firstName} {customer.lastName} - {customer.email}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Assign To</Label>
                    <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                      {employees.map((employee) => {
                        const checked = assignedEmployees.includes(employee.id)
                        const payType = employee.payType || "hourly"
                        const requiresPay = payType === "per_job"
                        const canOverride = payType !== "salary"
                        const overrideEnabled = requiresPay || assignmentPayOverrides[employee.id]
                        const suggested = getSuggestedPayForEmployee(employee.id)
                        const canCheckAvailability = Boolean(formData.scheduledFor)
                        const status = availability[employee.id]
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
                          <div key={employee.id} className="rounded-md border px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => toggleAssignedEmployee(employee.id, Boolean(value))}
                                />
                                <span>
                                  {employee.firstName} {employee.lastName} {employee.role && `- ${employee.role}`}
                                </span>
                              </label>
                              <span className="text-xs text-muted-foreground">
                                {payType === "salary" ? "Salary" : payType === "per_job" ? "Pay per job" : "Hourly"}
                              </span>
                            </div>
                            <div className="mt-1 text-xs">
                              <span className={statusClass}>{statusLabel}</span>
                            </div>
                            {checked && canOverride && (
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-xs font-medium">
                                  <Checkbox
                                    checked={overrideEnabled}
                                    onCheckedChange={(value) =>
                                      toggleAssignmentPayOverride(employee.id, Boolean(value))
                                    }
                                    disabled={requiresPay}
                                  />
                                  Set pay for this job
                                </label>
                                {overrideEnabled && (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder={suggested ? suggested.toFixed(2) : "0.00"}
                                    value={assignmentPays[employee.id] || ""}
                                    onChange={(e) => updateAssignmentPay(employee.id, e.target.value)}
                                    className="w-28"
                                    required={requiresPay}
                                  />
                                )}
                              </div>
                            )}
                            {checked && !canOverride && (
                              <p className="mt-2 text-xs text-muted-foreground">Salary employees do not have per-job pay.</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select one or more employees. Pay-per-job requires a value; hourly can be overridden per job.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="Address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="London"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) => handleChange("postcode", e.target.value)}
                      placeholder="SW1A 1AA"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="scheduling" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledFor">Scheduled Start</Label>
                    <Input
                      id="scheduledFor"
                      type="datetime-local"
                      value={formData.scheduledFor}
                      onChange={(e) => handleChange("scheduledFor", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledEnd">Scheduled End</Label>
                    <Input
                      id="scheduledEnd"
                      type="datetime-local"
                      value={formData.scheduledEnd}
                      onChange={(e) => handleChange("scheduledEnd", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="recurrence">Recurrence</Label>
                    <Select value={formData.recurrence} onValueChange={(value) => handleChange("recurrence", value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">One-time</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.recurrence !== "none" && (
                    <div className="grid gap-2">
                      <Label htmlFor="recurrenceEndDate">Recurrence End Date</Label>
                      <Input
                        id="recurrenceEndDate"
                        type="date"
                        value={formData.recurrenceEndDate}
                        onChange={(e) => handleChange("recurrenceEndDate", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="estimatedPrice">Estimated Price (£)</Label>
                    <Input
                      id="estimatedPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.estimatedPrice}
                      onChange={(e) => handleChange("estimatedPrice", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="actualPrice">Actual Price (£)</Label>
                    <Input
                      id="actualPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.actualPrice}
                      onChange={(e) => handleChange("actualPrice", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="accessInstructions">Access Instructions</Label>
                  <Textarea
                    id="accessInstructions"
                    value={formData.accessInstructions}
                    onChange={(e) => handleChange("accessInstructions", e.target.value)}
                    placeholder="How to access the property..."
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parkingInstructions">Parking Instructions</Label>
                  <Textarea
                    id="parkingInstructions"
                    value={formData.parkingInstructions}
                    onChange={(e) => handleChange("parkingInstructions", e.target.value)}
                    placeholder="Where to park or permits..."
                    rows={2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    value={formData.specialInstructions}
                    onChange={(e) => handleChange("specialInstructions", e.target.value)}
                    placeholder="Anything else we should know..."
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="internalNotes">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    value={formData.internalNotes}
                    onChange={(e) => handleChange("internalNotes", e.target.value)}
                    placeholder="Private notes (not visible to customer)..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="completion" className="space-y-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="completedAt">Completed At</Label>
                  <Input
                    id="completedAt"
                    type="datetime-local"
                    value={formData.completedAt}
                    onChange={(e) => handleChange("completedAt", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="qualityRating">Quality Rating (0-5)</Label>
                  <Input
                    id="qualityRating"
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={formData.qualityRating}
                    onChange={(e) => handleChange("qualityRating", e.target.value)}
                    placeholder="0.0"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customerFeedback">Customer Feedback</Label>
                  <Textarea
                    id="customerFeedback"
                    value={formData.customerFeedback}
                    onChange={(e) => handleChange("customerFeedback", e.target.value)}
                    placeholder="Customer's feedback on the job..."
                    rows={4}
                  />
                </div>
              </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="border-t bg-background px-4 py-3 sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Job"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
      <AlertDialog open={assigneeConfirmOpen} onOpenChange={setAssigneeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Completed Job Cleaner?</AlertDialogTitle>
            <AlertDialogDescription>
              This job is already completed. Changing who completed it will update employee hours and finance.
              Current: {getEmployeeNames(initialAssignedEmployees)}. New: {getEmployeeNames(assignedEmployees)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Keep Current Cleaner</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitUpdate}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}


