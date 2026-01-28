"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"

interface Customer {
  id: number
  name: string
  address?: string
  addressLine2?: string | null
  city?: string | null
  postcode?: string | null
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
  hourlyRate?: string | null
  payType?: string | null
}

interface JobSummary {
  id: number
  assignedTo?: number | null
  assignments?: { employeeId: number }[]
  scheduledFor: string | null
  scheduledEnd: string | null
  durationMinutes: number | null
  status: string
}
interface DuplicateJobInfo {
  id: number
  title: string
  scheduledFor: string | null
}

interface CleaningPlan {
  id: number
  name: string
  category: string | null
  estimatedDuration: string | null
  price?: string | null
  isActive?: number | null
  tasks?: PlanTask[]
}

interface CreateJobDialogProps {
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

const padTime = (value: number) => value.toString().padStart(2, "0")

const toLocalTimeInput = (date: Date) =>
  `${padTime(date.getHours())}:${padTime(date.getMinutes())}`

const formatAddress = (address?: CustomerAddress | null) => {
  if (!address) return ""
  return [address.address, address.addressLine2, address.city, address.postcode]
    .map((value) => (value ?? "").trim())
    .filter(Boolean)
    .join(", ")
}

const buildCustomerAddresses = (customer?: Customer | null): CustomerAddress[] => {
  if (!customer) return []

  const entries: CustomerAddress[] = []

  if (customer.address) {
    entries.push({
      key: "primary",
      label: "Primary",
      address: customer.address.trim(),
      addressLine2: customer.addressLine2?.trim() || "",
      city: customer.city?.trim() || "",
      postcode: customer.postcode?.trim() || "",
      country: customer.country?.trim() || "",
      accessInstructions: customer.accessInstructions || "",
      parkingInstructions: customer.parkingInstructions || "",
      specialInstructions: customer.specialInstructions || "",
    })
  }

  const extraAddresses = (customer.addresses || []).map((addr, index) => ({
    key: addr.key ?? `addr-${addr.id ?? index}`,
    label: addr.label || `Address ${index + 2}`,
    address: addr.address,
    addressLine2: addr.addressLine2 || "",
    city: addr.city || "",
    postcode: addr.postcode || "",
    country: addr.country || "",
    accessInstructions: addr.accessInstructions || "",
    parkingInstructions: addr.parkingInstructions || "",
    specialInstructions: addr.specialInstructions || "",
  }))

  return [...entries, ...extraAddresses]
}

export function CreateJobDialog({ open, onOpenChange, onSuccess }: CreateJobDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [plans, setPlans] = useState<CleaningPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [availability, setAvailability] = useState<Record<string, "available" | "busy">>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateJobs, setDuplicateJobs] = useState<DuplicateJobInfo[]>([])
  const [pastDateConfirmOpen, setPastDateConfirmOpen] = useState(false)
  const { toast } = useToast()

  // Form state
  const [customerId, setCustomerId] = useState("")
  const [location, setLocation] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([])
  const [recurring, setRecurring] = useState("once")
  const [notes, setNotes] = useState("")
  const [planId, setPlanId] = useState("")
  const [planPriceOverride, setPlanPriceOverride] = useState("")
  const [assignmentPays, setAssignmentPays] = useState<Record<string, string>>({})
  const [assignmentPayOverrides, setAssignmentPayOverrides] = useState<Record<string, boolean>>({})
  const [selectedAddressKey, setSelectedAddressKey] = useState("")
  const canCheckAvailability = Boolean(date && time)
  const primaryAssigneeId = assignedEmployeeIds[0] || ""
  const hasBusyAssignee = assignedEmployeeIds.some((id) => availability[id] === "busy")
  const minTime = undefined
  const [customizeTasks, setCustomizeTasks] = useState(false)
  const [customTasks, setCustomTasks] = useState<JobTaskDraft[]>([])

  useEffect(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === planId)
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
  }, [planId, plans])

  const addTask = () => {
    setCustomTasks((prev) => [...prev, { title: "", description: "", order: prev.length }])
  }

  const updateTask = (index: number, field: "title" | "description", value: string) => {
    setCustomTasks((prev) => prev.map((task, i) => (i === index ? { ...task, [field]: value } : task)))
  }

  const removeTask = (index: number) => {
    setCustomTasks((prev) => prev.filter((_, i) => i !== index))
  }
  useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [customersRes, employeesRes, plansRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/employees?status=active"),
        fetch("/api/cleaning-plans"),
      ])

      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data)
      }
      if (employeesRes.ok) {
        const data = await employeesRes.json()
        setEmployees(data)
      }
      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const selectedCustomer = customers.find((customer) => customer.id.toString() === customerId)
  const customerAddresses = selectedCustomer ? buildCustomerAddresses(selectedCustomer) : []

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

  const selectedPlanDuration = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === planId)
    return parseDurationMinutes(selectedPlan?.estimatedDuration)
  }, [plans, planId])

  const selectedPlanPrice = useMemo(() => {
    const selectedPlan = plans.find((plan) => plan.id.toString() === planId)
    const price = selectedPlan?.price ? parseFloat(selectedPlan.price) : 0
    return Number.isFinite(price) && price > 0 ? price : 0
  }, [plans, planId])

  useEffect(() => {
    if (!planId) {
      setPlanPriceOverride("")
      return
    }
    setPlanPriceOverride(selectedPlanPrice ? selectedPlanPrice.toFixed(2) : "")
  }, [planId, selectedPlanPrice])

  const selectedEmployeeRate = useMemo(() => {
    if (!primaryAssigneeId) return 0
    const selectedEmployee = employees.find((employee) => employee.id.toString() === primaryAssigneeId)
    const rate = selectedEmployee?.hourlyRate ? parseFloat(selectedEmployee.hourlyRate) : 0
    return Number.isFinite(rate) && rate > 0 ? rate : 0
  }, [employees, primaryAssigneeId])

  const suggestedEmployeePay = useMemo(() => {
    if (!selectedEmployeeRate || !selectedPlanDuration) return 0
    const hours = selectedPlanDuration / 60
    const raw = selectedEmployeeRate * hours
    if (selectedPlanPrice > 0) {
      return Math.min(raw, selectedPlanPrice)
    }
    return raw
  }, [selectedEmployeeRate, selectedPlanDuration, selectedPlanPrice])

  const getSuggestedPayForEmployee = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id.toString() === employeeId)
    const rate = employee?.hourlyRate ? parseFloat(employee.hourlyRate) : 0
    if (!Number.isFinite(rate) || rate <= 0 || !selectedPlanDuration) return 0
    const hours = selectedPlanDuration / 60
    const raw = rate * hours
    if (selectedPlanPrice > 0) {
      return Math.min(raw, selectedPlanPrice)
    }
    return raw
  }

  useEffect(() => {
    if (!open || !canCheckAvailability || employees.length === 0) {
      setAvailability({})
      return
    }

    const fetchAvailability = async () => {
      setAvailabilityLoading(true)
      try {
        const start = new Date(`${date}T${time}`)
        if (Number.isNaN(start.getTime())) {
          setAvailability({})
          return
        }
        const end = new Date(start.getTime() + selectedPlanDuration * 60000)
        const windowStart = new Date(start.getTime() - selectedPlanDuration * 60000)
        const windowEnd = new Date(end.getTime() + selectedPlanDuration * 60000)
        const params = new URLSearchParams({
          startDate: windowStart.toISOString(),
          endDate: windowEnd.toISOString(),
        })
        const response = await fetch(`/api/jobs?${params.toString()}`)
        if (!response.ok) {
          setAvailability({})
          return
        }
        const jobs: JobSummary[] = await response.json()
        const acceptedStatuses = new Set(["scheduled", "in-progress"])
        const busyEmployeeIds = new Set<number>()

        for (const job of jobs) {
          if (!job.scheduledFor || !acceptedStatuses.has(job.status)) {
            continue
          }
          const assignedIds =
            job.assignments?.map((assignment) => assignment.employeeId) ??
            (job.assignedTo ? [job.assignedTo] : [])
          if (assignedIds.length === 0) {
            continue
          }
          const jobStart = new Date(job.scheduledFor)
          if (Number.isNaN(jobStart.getTime())) {
            continue
          }
          const jobDuration = job.durationMinutes && job.durationMinutes > 0 ? job.durationMinutes : 60
          const jobEnd = job.scheduledEnd ? new Date(job.scheduledEnd) : new Date(jobStart.getTime() + jobDuration * 60000)
          if (start < jobEnd && end > jobStart) {
            for (const employeeId of assignedIds) {
              busyEmployeeIds.add(employeeId)
            }
          }
        }

        const nextAvailability: Record<string, "available" | "busy"> = {}
        for (const employee of employees) {
          nextAvailability[employee.id.toString()] = busyEmployeeIds.has(employee.id) ? "busy" : "available"
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
  }, [open, canCheckAvailability, date, time, employees, selectedPlanDuration])

  const handleCustomerChange = (value: string) => {
    setCustomerId(value)
    const customer = customers.find((c) => c.id.toString() === value)
    if (!customer) {
      setLocation("")
      setSelectedAddressKey("")
      return
    }
    const addresses = buildCustomerAddresses(customer)
    const defaultAddress = addresses[0]
    setSelectedAddressKey(defaultAddress?.key || "")
    setLocation(formatAddress(defaultAddress))
  }

  const handleAddressSelect = (value: string) => {
    const match = customerAddresses.find((addr) => addr.key === value)
    if (!match) return
    setSelectedAddressKey(value)
    setLocation(formatAddress(match))
  }

  const toggleAssignedEmployee = (employeeId: string, checked: boolean) => {
    setAssignedEmployeeIds((prev) => {
      if (checked) {
        return prev.includes(employeeId) ? prev : [...prev, employeeId]
      }
      return prev.filter((id) => id !== employeeId)
    })
    if (checked) {
      const employee = employees.find((emp) => emp.id.toString() === employeeId)
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

  const updateAssignmentPay = (employeeId: string, value: string) => {
    setAssignmentPays((prev) => ({ ...prev, [employeeId]: value }))
  }

  const toggleAssignmentPayOverride = (employeeId: string, checked: boolean) => {
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

  const resetForm = () => {
    setCustomerId("")
    setLocation("")
    setDate("")
    setTime("")
    setAssignedEmployeeIds([])
    setRecurring("once")
    setNotes("")
    setPlanId("")
    setPlanPriceOverride("")
    setSelectedAddressKey("")
    setCustomizeTasks(false)
    setCustomTasks([])
    setAssignmentPays({})
    setAssignmentPayOverrides({})
  }

  const findDuplicates = async (scheduledDate: Date) => {
    const windowStart = new Date(scheduledDate.getTime() - 5 * 60 * 1000)
    const windowEnd = new Date(scheduledDate.getTime() + 5 * 60 * 1000)
    const params = new URLSearchParams({
      customerId,
      startDate: windowStart.toISOString(),
      endDate: windowEnd.toISOString(),
    })
    const response = await fetch(`/api/jobs?${params.toString()}`)
    if (!response.ok) return []
    const jobs: DuplicateJobInfo[] = await response.json()
    return jobs.filter((job) => {
      if (!job.scheduledFor) return false
      const jobTime = new Date(job.scheduledFor).getTime()
      return Math.abs(jobTime - scheduledDate.getTime()) <= 5 * 60 * 1000
    })
  }

  const createJob = async (
    scheduledDate: Date,
    address: CustomerAddress,
    locationLabel: string,
    allowPast = false,
    backCreateComplete = false,
  ) => {
    const selectedPlan = plans.find(p => p.id.toString() === planId)
    const jobTitle = selectedPlan?.name || "Cleaning Job"
    const assignmentPayload = assignedEmployeeIds.map((employeeId) => ({
      employeeId: parseInt(employeeId),
      payAmount: assignmentPays[employeeId] || null,
    }))

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: jobTitle,
        customerId: parseInt(customerId),
        assignedTo: primaryAssigneeId ? parseInt(primaryAssigneeId) : null,
        assignedEmployees: assignmentPayload,
        scheduledFor: scheduledDate.toISOString(),
        location: locationLabel,
        addressLine2: address.addressLine2?.trim() || undefined,
        city: address.city?.trim() || undefined,
        postcode: address.postcode?.trim() || undefined,
        accessInstructions: address.accessInstructions || undefined,
        parkingInstructions: address.parkingInstructions || undefined,
        specialInstructions: address.specialInstructions || undefined,
        durationMinutes: selectedPlanDuration,
        planId: parseInt(planId),
        estimatedPrice: planPriceOverride ? parseFloat(planPriceOverride) : undefined,
        status: "scheduled",
        notes: notes || undefined,
        allowPast,
        backCreateComplete,
        recurring: recurring !== "once" ? recurring : undefined,
        tasks: customizeTasks
          ? customTasks.map((task, index) => ({
              title: task.title.trim(),
              description: task.description.trim() || null,
              order: index,
            }))
          : undefined,
      }),
    })

    if (response.ok) {
      toast({ title: "Success", description: "Job created successfully" })
      resetForm()
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
      window.dispatchEvent(new CustomEvent("jobs:updated"))
    } else {
      const error = await response.json()
      toast({ title: "Error", description: error.error || "Failed to create job", variant: "destructive" })
    }
  }

  const handleSubmit = async (
    skipDuplicateCheck = false,
    skipPastDateCheck = false,
    backCreateComplete = false,
  ) => {
    if (!customerId || !date || !time || assignedEmployeeIds.length === 0 || !planId) {
      toast({
        title: "Error",
        description: "Plan, client address, and assigned staff are required",
        variant: "destructive",
      })
      return
    }

    for (const employeeId of assignedEmployeeIds) {
      const employee = employees.find((emp) => emp.id.toString() === employeeId)
      const requiresPay = employee?.payType === "per_job"
      const wantsOverride = assignmentPayOverrides[employeeId]
      if ((requiresPay || wantsOverride) && !assignmentPays[employeeId]) {
        toast({
          title: "Pay required",
          description: `Enter pay for ${employee.firstName} ${employee.lastName}`,
          variant: "destructive",
        })
        return
      }
    }

    if (customizeTasks && customTasks.some((task) => !task.title.trim())) {
      toast({
        title: "Error",
        description: "All tasks must have a title",
        variant: "destructive",
      })
      return
    }

    const selectedAddress =
      customerAddresses.find((addr) => addr.key === selectedAddressKey) || customerAddresses[0]

    if (!selectedAddress) {
      toast({
        title: "Missing client address",
        description: "Please add an address to the selected client before creating a job.",
        variant: "destructive",
      })
      return
    }

    const locationLabel = formatAddress(selectedAddress)
    if (!locationLabel) {
      toast({
        title: "Missing client address",
        description: "Please add an address to the selected client before creating a job.",
        variant: "destructive",
      })
      return
    }

    const scheduledDate = new Date(`${date}T${time}`)
    if (Number.isNaN(scheduledDate.getTime())) {
      toast({
        title: "Error",
        description: "Scheduled time is invalid",
        variant: "destructive",
      })
      return
    }

    // Check if date is in the past and show confirmation
    if (!skipPastDateCheck && (scheduledDate.getTime() < Date.now() || date < today)) {
      setPastDateConfirmOpen(true)
      return
    }

    setSubmitting(true)
    try {
      if (!skipDuplicateCheck) {
        const duplicates = await findDuplicates(scheduledDate)
        if (duplicates.length > 0) {
          setDuplicateJobs(duplicates)
          setDuplicateDialogOpen(true)
          return
        }
      }
      await createJob(
        scheduledDate,
        selectedAddress,
        locationLabel,
        skipPastDateCheck || backCreateComplete,
        backCreateComplete
      )
    } catch (error) {
      toast({ title: "Error", description: "Failed to create job", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl sm:max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Select a client, schedule the job, and assign a cleaner.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4 sm:py-6">
              <div className="grid gap-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={customerId} onValueChange={handleCustomerChange}>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        <span className="block truncate">{customer.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="location">Location *</Label>
                <Select
                  value={selectedAddressKey}
                  onValueChange={handleAddressSelect}
                  disabled={!selectedCustomer || customerAddresses.length === 0}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder={selectedCustomer ? "Select address" : "Select client first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerAddresses.map((addr) => (
                      <SelectItem key={addr.key} value={addr.key} className="whitespace-normal">
                        <span className="block text-xs font-medium text-muted-foreground">{addr.label}</span>
                        <span className="block text-sm">
                          {addr.address}
                          {addr.city ? `, ${addr.city}` : ""}
                          {addr.postcode ? ` ${addr.postcode}` : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Selected address"
                  value={location}
                  readOnly
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date *</Label>
                    <Input 
                      id="date" 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time *</Label>
                    <Input 
                      id="time" 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="plan">Cleaning Plan *</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select cleaning plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => {
                      const isInactive = plan.isActive === 0
                      const isDisabled = isInactive && plan.id.toString() !== planId
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
              <div className="grid gap-2">
                <Label htmlFor="plan-price">Plan Price (£)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={planPriceOverride}
                  onChange={(e) => setPlanPriceOverride(e.target.value)}
                  placeholder={planId ? selectedPlanPrice.toFixed(2) : "Select a plan"}
                  disabled={!planId}
                />
                <p className="text-xs text-muted-foreground">
                  This overrides the price for this job only.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="customizeTasks"
                  checked={customizeTasks}
                  onCheckedChange={(value) => setCustomizeTasks(Boolean(value))}
                  disabled={!planId}
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

              <div className="grid gap-2">
                <Label htmlFor="staff">Assign Staff *</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-2">
                  {employees.map((employee) => {
                    const employeeId = employee.id.toString()
                    const status = availability[employeeId]
                    const checked = assignedEmployeeIds.includes(employeeId)
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
                      <div key={employee.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleAssignedEmployee(employeeId, Boolean(value))}
                            disabled={!canCheckAvailability}
                          />
                          <span>{employee.firstName} {employee.lastName}</span>
                        </label>
                        <span className={`text-xs ${statusClass}`}>{statusLabel}</span>
                      </div>
                    )
                  })}
                </div>
                {!canCheckAvailability && (
                  <p className="text-xs text-muted-foreground">Pick a date and time to see availability.</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Cleaner Pay (override)</Label>
                {assignedEmployeeIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Select staff to set pay.</p>
                ) : (
                  <div className="space-y-2">
                    {assignedEmployeeIds.map((employeeId) => {
                      const employee = employees.find((emp) => emp.id.toString() === employeeId)
                      if (!employee) return null
                      const payType = employee.payType || "hourly"
                      const requiresPay = payType === "per_job"
                      const canOverride = payType !== "salary"
                      const overrideEnabled = requiresPay || assignmentPayOverrides[employeeId]
                      const suggested = getSuggestedPayForEmployee(employeeId)
                      return (
                        <div key={employeeId} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{employee.firstName} {employee.lastName}</p>
                              <p className="text-xs text-muted-foreground">
                                {payType === "salary" ? "Salary" : payType === "per_job" ? "Pay per job" : "Hourly rate"}
                              </p>
                            </div>
                            {canOverride ? (
                              <label className="flex items-center gap-2 text-xs font-medium">
                                <Checkbox
                                  checked={overrideEnabled}
                                  onCheckedChange={(value) => toggleAssignmentPayOverride(employeeId, Boolean(value))}
                                  disabled={requiresPay}
                                />
                                Set pay for this job
                              </label>
                            ) : (
                              <span className="text-xs text-muted-foreground">No per-job pay</span>
                            )}
                          </div>
                          {canOverride && overrideEnabled && (
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={assignmentPays[employeeId] || ""}
                                onChange={(e) => updateAssignmentPay(employeeId, e.target.value)}
                                placeholder={suggested ? suggested.toFixed(2) : "0.00"}
                                className="w-32"
                                required={requiresPay}
                              />
                              {suggested > 0 && (
                                <span className="text-xs text-muted-foreground">Suggested £{suggested.toFixed(2)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Pay-per-job requires a value. Hourly staff can be overridden for this job.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="recurring">Recurring</Label>
                <Select value={recurring} onValueChange={setRecurring}>
                  <SelectTrigger id="recurring">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Add any special instructions..." 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting ||
                  !customerId ||
                  !date ||
                  !time ||
                  !location ||
                  assignedEmployeeIds.length === 0 ||
                  !planId ||
                  hasBusyAssignee
                }
                className="w-full sm:w-auto"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Job
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Possible duplicate job</AlertDialogTitle>
          <AlertDialogDescription>
            There is already a job for this client around the same time. Create anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          {duplicateJobs.slice(0, 3).map((job) => (
            <div key={job.id} className="rounded-md border px-3 py-2">
              <div className="font-medium text-foreground">{job.title}</div>
              <div>
                {job.scheduledFor ? new Date(job.scheduledFor).toLocaleString() : "Time not set"}
              </div>
            </div>
          ))}
          {duplicateJobs.length > 3 && (
            <div>And {duplicateJobs.length - 3} more.</div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Go Back</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleSubmit(true, true)}
            className="bg-red-600 hover:bg-red-700"
          >
            Create Duplicate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Past Date Confirmation Dialog */}
    <AlertDialog open={pastDateConfirmOpen} onOpenChange={setPastDateConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Back-create Job?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This job is scheduled in the past. Do you want to back-create it and mark it as completed?
            <br /><br />
            <span className="font-medium">
              Scheduled for: {date && time ? new Date(`${date}T${time}`).toLocaleString() : "Unknown"}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setPastDateConfirmOpen(false)
              handleSubmit(false, true)
            }}
            disabled={submitting}
            className="bg-muted text-foreground hover:bg-muted"
          >
            Create as Scheduled
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => {
              setPastDateConfirmOpen(false)
              handleSubmit(false, true, true)
            }}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Back-create & Complete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

