"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react"

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
  address?: string | null
  city?: string | null
  postcode?: string | null
  addressLine2?: string | null
  country?: string | null
  accessInstructions?: string | null
  parkingInstructions?: string | null
  specialInstructions?: string | null
  addresses?: CustomerAddress[]
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
  category: string | null
  estimatedDuration: string | null
  isActive?: number | null
  tasks?: PlanTask[]
}

interface AddJobDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type CustomerAddress = {
  key?: string
  id?: number
  label?: string | null
  address: string
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
  country?: string | null
  accessInstructions?: string | null
  parkingInstructions?: string | null
  specialInstructions?: string | null
}

type PlanTask = {
  id: number
  title: string
  description: string | null
  order: number | null
}

type JobTaskDraft = {
  title: string
  description: string
  order: number
}

const parseDurationMinutes = (value?: string | null) => {
  if (!value) return 60
  const normalized = value.toLowerCase()
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/)
  const minMatch = normalized.match(/(\d+(?:\.\d+)?)\s*m/)
  if (hourMatch || minMatch) {
    const hours = hourMatch ? Math.round(parseFloat(hourMatch[1]) * 60) : 0
    const mins = minMatch ? Math.round(parseFloat(minMatch[1])) : 0
    return Math.max(15, hours + mins)
  }
  const numeric = parseInt(normalized, 10)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 60
}

const padTime = (value: number) => value.toString().padStart(2, "0")

const toLocalDateTimeInput = (date: Date) => {
  const year = date.getFullYear()
  const month = padTime(date.getMonth() + 1)
  const day = padTime(date.getDate())
  const hours = padTime(date.getHours())
  const minutes = padTime(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function AddJobDialog({ open, onOpenChange, onSuccess }: AddJobDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [plans, setPlans] = useState<CleaningPlan[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [customizeTasks, setCustomizeTasks] = useState(false)
  const [customTasks, setCustomTasks] = useState<JobTaskDraft[]>([])
  const [selectedAddressKey, setSelectedAddressKey] = useState("")
  const [pastDateConfirmOpen, setPastDateConfirmOpen] = useState(false)
  const [assignedEmployees, setAssignedEmployees] = useState<number[]>([])
  const [assignmentPays, setAssignmentPays] = useState<Record<number, string>>({})
  const [assignmentPayOverrides, setAssignmentPayOverrides] = useState<Record<number, boolean>>({})

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customerId: "",
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
    priority: "normal",
    estimatedPrice: "",
    currency: "GBP",
    internalNotes: "",
    planId: "",
  })
  const minDateTime = toLocalDateTimeInput(new Date())

  const selectedCustomer = customers.find((customer) => customer.id === parseInt(formData.customerId))
  const selectedPlanDuration = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === formData.planId)
    return parseDurationMinutes(selectedPlan?.estimatedDuration)
  }, [plans, formData.planId])
  const customerAddresses = selectedCustomer
    ? [
        ...(selectedCustomer.address
          ? [
              {
                key: "primary",
                label: "Primary",
                address: selectedCustomer.address,
                addressLine2: selectedCustomer.addressLine2 || "",
                city: selectedCustomer.city || "",
                postcode: selectedCustomer.postcode || "",
                country: selectedCustomer.country || "",
                accessInstructions: selectedCustomer.accessInstructions || "",
                parkingInstructions: selectedCustomer.parkingInstructions || "",
                specialInstructions: selectedCustomer.specialInstructions || "",
              },
            ]
          : []),
        ...(selectedCustomer.addresses || []).map((addr, index) => ({
          key: `addr-${addr.id ?? index}`,
          label: addr.label || `Address ${index + 2}`,
          address: addr.address,
          addressLine2: addr.addressLine2 || "",
          city: addr.city || "",
          postcode: addr.postcode || "",
          country: addr.country || "",
          accessInstructions: addr.accessInstructions || "",
          parkingInstructions: addr.parkingInstructions || "",
          specialInstructions: addr.specialInstructions || "",
        })),
      ]
    : []

  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedAddressKey("")
      return
    }
    const defaultAddress = customerAddresses[0]
    if (!defaultAddress) return
    setSelectedAddressKey(defaultAddress.key)
    setFormData((prev) => ({
      ...prev,
      location: defaultAddress.address,
      addressLine2: defaultAddress.addressLine2 || "",
      city: defaultAddress.city || "",
      postcode: defaultAddress.postcode || "",
      accessInstructions: defaultAddress.accessInstructions || "",
      parkingInstructions: defaultAddress.parkingInstructions || "",
      specialInstructions: defaultAddress.specialInstructions || "",
    }))
  }, [selectedCustomer, customerAddresses])

  const handleAddressSelect = (value: string) => {
    setSelectedAddressKey(value)
    const match = customerAddresses.find((addr) => addr.key === value)
    if (!match) return
    setFormData((prev) => ({
      ...prev,
      location: match.address,
      addressLine2: match.addressLine2 || "",
      city: match.city || "",
      postcode: match.postcode || "",
      accessInstructions: match.accessInstructions || "",
      parkingInstructions: match.parkingInstructions || "",
      specialInstructions: match.specialInstructions || "",
    }))
  }

  useEffect(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === formData.planId)
    if (selectedPlan?.tasks && selectedPlan.tasks.length > 0) {
      const mapped = selectedPlan.tasks
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((task, index) => ({
          title: task.title,
          description: task.description || "",
          order: task.order ?? index,
        }))
      setCustomTasks(mapped)
    } else {
      setCustomTasks([])
    }
  }, [formData.planId, plans])

  useEffect(() => {
    if (!formData.planId) return
    setFormData((prev) => ({
      ...prev,
      durationMinutes: selectedPlanDuration.toString(),
    }))
  }, [formData.planId, selectedPlanDuration])

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
        setPlans(plansData)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })

    // Auto-fill location from customer
    if (field === "customerId" && value) {
      const customer = customers.find((c) => c.id === parseInt(value))
      if (customer) {
        const primary = customer.address
          ? {
              address: customer.address,
              addressLine2: customer.addressLine2 || "",
              city: customer.city || "",
              postcode: customer.postcode || "",
              accessInstructions: customer.accessInstructions || "",
              parkingInstructions: customer.parkingInstructions || "",
              specialInstructions: customer.specialInstructions || "",
            }
          : { address: "", addressLine2: "", city: "", postcode: "", accessInstructions: "", parkingInstructions: "", specialInstructions: "" }
        setSelectedAddressKey(customer.address ? "primary" : "")
        setFormData((prev) => ({
          ...prev,
          customerId: value,
          location: primary.address,
          addressLine2: primary.addressLine2,
          city: primary.city,
          postcode: primary.postcode,
          accessInstructions: primary.accessInstructions,
          parkingInstructions: primary.parkingInstructions,
          specialInstructions: primary.specialInstructions,
        }))
      }
    }
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
    if (!Number.isFinite(rate) || rate <= 0 || !selectedPlanDuration) return 0
    const hours = selectedPlanDuration / 60
    return rate * hours
  }

  const addTask = () => {
    setCustomTasks((prev) => [...prev, { title: "", description: "", order: prev.length }])
  }

  const updateTask = (index: number, field: "title" | "description", value: string) => {
    setCustomTasks((prev) => prev.map((task, i) => (i === index ? { ...task, [field]: value } : task)))
  }

  const removeTask = (index: number) => {
    setCustomTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const submitJob = async () => {
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
          throw new Error(`Pay is required for ${employee.firstName} ${employee.lastName}`)
        }
      }

      const assignmentPayload = assignedEmployees.map((employeeId) => ({
        employeeId,
        payAmount: assignmentPays[employeeId] || null,
      }))

      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          customerId: parseInt(formData.customerId),
          assignedTo: assignedEmployees[0] ?? null,
          assignedEmployees: assignmentPayload,
          planId: formData.planId ? parseInt(formData.planId) : null,
          durationMinutes: parseInt(formData.durationMinutes),
          estimatedPrice: formData.estimatedPrice ? parseFloat(formData.estimatedPrice) : null,
          tasks: customizeTasks
            ? customTasks.map((task, index) => ({
                title: task.title.trim(),
                description: task.description.trim() || null,
                order: index,
              }))
            : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create job")
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        customerId: "",
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
        priority: "normal",
        estimatedPrice: "",
        currency: "GBP",
        internalNotes: "",
        planId: "",
      })
      setAssignedEmployees([])
      setAssignmentPays({})
      setAssignmentPayOverrides({})
      setSelectedAddressKey("")
      setCustomizeTasks(false)
      setCustomTasks([])

      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.location || assignedEmployees.length === 0 || !formData.planId) {
      setError("Plan, location, and assigned staff are required.")
      return
    }

    if (customizeTasks && customTasks.some((task) => !task.title.trim())) {
      setError("All tasks must have a title.")
      return
    }

    if (formData.scheduledFor) {
      const scheduledStart = new Date(formData.scheduledFor)
      if (Number.isNaN(scheduledStart.getTime())) {
        setError("Scheduled start time is invalid.")
        return
      }
      // Check if date is in the past
      if (scheduledStart.getTime() < Date.now()) {
        setPastDateConfirmOpen(true)
        return
      }
    }

    await submitJob()
  }

  const handleConfirmPastDate = async () => {
    setPastDateConfirmOpen(false)
    await submitJob()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 gap-2 h-9">
                <TabsTrigger value="basic" className="text-xs sm:text-sm">Basic Info</TabsTrigger>
                <TabsTrigger value="scheduling" className="text-xs sm:text-sm">Scheduling</TabsTrigger>
                <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
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
                    placeholder="e.g., Weekly Office Cleaning"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Describe the job requirements..."
                    rows={3}
                  />
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                      <SelectTrigger>
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
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="planId">
                    Cleaning Plan <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.planId} onValueChange={(value) => handleChange("planId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cleaning plan" />
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="customizeTasks"
                    checked={customizeTasks}
                    onCheckedChange={(value) => setCustomizeTasks(Boolean(value))}
                    disabled={!formData.planId}
                  />
                  <Label htmlFor="customizeTasks" className="text-sm">
                    Customize tasks for this job
                  </Label>
                </div>
                {customizeTasks && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Tasks</p>
                      <Button type="button" variant="outline" size="sm" onClick={addTask}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add task
                      </Button>
                    </div>
                    {customTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tasks added yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {customTasks.map((task, index) => (
                          <div key={index} className="space-y-2 rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs text-muted-foreground">Task {index + 1}</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTask(index)}
                                aria-label="Remove task"
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                            <Input
                              value={task.title}
                              onChange={(e) => updateTask(index, "title", e.target.value)}
                              placeholder="Task title"
                            />
                            <Textarea
                              value={task.description}
                              onChange={(e) => updateTask(index, "description", e.target.value)}
                              placeholder="Task description (optional)"
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customerId">
                      Customer <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formData.customerId} onValueChange={(value) => handleChange("customerId", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.firstName} {customer.lastName} - {customer.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>
                      Assign To <span className="text-destructive">*</span>
                    </Label>
                    <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                      {employees.map((employee) => {
                        const checked = assignedEmployees.includes(employee.id)
                        const payType = employee.payType || "hourly"
                        const requiresPay = payType === "per_job"
                        const canOverride = payType !== "salary"
                        const overrideEnabled = requiresPay || assignmentPayOverrides[employee.id]
                        const suggested = getSuggestedPayForEmployee(employee.id)
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
                  <Label>Service Address</Label>
                  <Select
                    value={selectedAddressKey}
                    onValueChange={handleAddressSelect}
                    disabled={!selectedCustomer || customerAddresses.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedCustomer ? "Select address" : "Select customer first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customerAddresses.map((addr) => (
                        <SelectItem key={addr.key} value={addr.key}>
                          {addr.label}: {addr.address}
                          {addr.city ? `, ${addr.city}` : ""}
                          {addr.postcode ? ` ${addr.postcode}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="location">
                    Location <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="Address"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
              </TabsContent>

              <TabsContent value="scheduling" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledFor">Scheduled Start</Label>
                    <Input
                      id="scheduledFor"
                      type="datetime-local"
                      value={formData.scheduledFor}
                      min={minDateTime}
                      onChange={(e) => handleChange("scheduledFor", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="scheduledEnd">Scheduled End</Label>
                    <Input
                      id="scheduledEnd"
                      type="datetime-local"
                      value={formData.scheduledEnd}
                      min={minDateTime}
                      onChange={(e) => handleChange("scheduledEnd", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="recurrence">Recurrence</Label>
                    <Select value={formData.recurrence} onValueChange={(value) => handleChange("recurrence", value)}>
                      <SelectTrigger>
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

                {formData.recurrence !== "none" && (
                  <Alert>
                    <AlertDescription>
                      This job will repeat {formData.recurrence} until{" "}
                      {formData.recurrenceEndDate || "manually stopped"}.
                    </AlertDescription>
                  </Alert>
                )}
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
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => handleChange("currency", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
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
            </Tabs>

            <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Job"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {/* Past Date Confirmation Dialog */}
      <AlertDialog open={pastDateConfirmOpen} onOpenChange={setPastDateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Scheduling Job in the Past
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create a job scheduled for a past date/time. Are you sure you want to continue?
              <br /><br />
              <span className="font-medium">
                Scheduled for: {formData.scheduledFor ? new Date(formData.scheduledFor).toLocaleString() : "Unknown"}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPastDate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Yes, Create Job"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
