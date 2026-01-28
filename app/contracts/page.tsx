"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Plus,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  CalendarPlus,
  Repeat,
  KeyRound as Pound,
  Bell,
  Edit,
  Send,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  Mail,
} from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  postcode?: string | null
}

  interface Contract {
    id: number
    contractNumber: string
  title: string
  description?: string | null
  frequency?: string | null
  startDate: string
  endDate?: string | null
  autoRenew: number
  amount: string
  billingFrequency?: string | null
  status: string
  notes?: string | null
  terms?: string | null
  customerId: number
  customer?: Customer
  createdAt: string
  signedAt?: string | null
  cancelledAt?: string | null
    // New fields
    scheduleDays?: ScheduleDay[] | null
    hoursPerWeek?: string | null
    hourlyRate?: string | null
    annualValue?: string | null
    employeeIds?: number[] | null
  }

interface ScheduleDay {
  day: string
  startTime: string
  durationMinutes: number
  tasks?: string[]
}

interface Employee {
  id: number
  firstName: string
  lastName: string
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" /> Active
        </Badge>
      )
    case "expiring":
      return (
        <Badge className="bg-orange-500">
          <AlertTriangle className="h-3 w-3 mr-1" /> Expiring Soon
        </Badge>
      )
    case "expired":
      return (
        <Badge variant="destructive">
          <Clock className="h-3 w-3 mr-1" /> Expired
        </Badge>
      )
    case "cancelled":
      return (
        <Badge variant="destructive">
          <X className="h-3 w-3 mr-1" /> Cancelled
        </Badge>
      )
    case "draft":
      return (
        <Badge variant="outline">
          <FileText className="h-3 w-3 mr-1" /> Draft
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function calculateDaysUntilEnd(endDate: string | null | undefined): number | null {
  if (!endDate) return null
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function getContractStatus(contract: Contract): string {
  if (contract.status === "cancelled") return "cancelled"
  if (contract.status === "draft") return "draft"
  
  const daysUntilEnd = calculateDaysUntilEnd(contract.endDate)
  
  if (daysUntilEnd !== null) {
    if (daysUntilEnd < 0) return "expired"
    if (daysUntilEnd <= 60) return "expiring"
  }
  
  return "active"
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contractToDelete, setContractToDelete] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [contractToActivate, setContractToActivate] = useState<Contract | null>(null)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({})

  // Form state for create/edit
  const [formData, setFormData] = useState({
    customerId: "",
    title: "",
    description: "",
    frequency: "weekly",
    startDate: "",
    endDate: "",
    autoRenew: false,
    amount: "",
    billingFrequency: "monthly",
    notes: "",
    terms: "",
    // New fields
    scheduleDays: [] as ScheduleDay[],
    hoursPerWeek: "",
    hourlyRate: "",
    annualValue: "",
    employeeIds: [] as string[],
  })

  // Generate jobs form state
  const [generateForm, setGenerateForm] = useState({
    weeksAhead: 4,
    assignedTo: "",
    defaultStartTime: "09:00",
    defaultDurationMinutes: 120,
  })

  const todayDate = new Date().toISOString().split("T")[0]

  const calculateWeeklyHours = (scheduleDays: ScheduleDay[], employeeIds: string[]) => {
    const totalDayHours = scheduleDays.reduce((sum, day) => {
      const minutes = Number(day.durationMinutes) || 0
      return sum + minutes / 60
    }, 0)
    const employeeCount = employeeIds.length
    if (totalDayHours === 0) return 0
    return totalDayHours * (employeeCount || 1)
  }

  const weeklyHours = calculateWeeklyHours(formData.scheduleDays, formData.employeeIds)
  const weeklyHoursDisplay = weeklyHours > 0
    ? (Number.isInteger(weeklyHours) ? weeklyHours.toString() : weeklyHours.toFixed(2))
    : ""

  const getMinEndDate = () => {
    if (formData.startDate && formData.startDate > todayDate) {
      return formData.startDate
    }
    return todayDate
  }

  const fetchContracts = useCallback(async () => {
    try {
      const response = await fetch("/api/contracts")
      if (!response.ok) throw new Error("Failed to fetch contracts")
      const data = await response.json()
      setContracts(data)
    } catch (error) {
      console.error("Error fetching contracts:", error)
      toast.error("Failed to load contracts")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await fetch("/api/customers")
      if (!response.ok) throw new Error("Failed to fetch customers")
      const data = await response.json()
      setCustomers(data)
    } catch (error) {
      console.error("Error fetching customers:", error)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees")
      if (!response.ok) throw new Error("Failed to fetch employees")
      const data = await response.json()
      setEmployees(data)
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }, [])

  useEffect(() => {
    fetchContracts()
    fetchCustomers()
    fetchEmployees()
  }, [fetchContracts, fetchCustomers, fetchEmployees])

  const resetForm = () => {
      setFormData({
        customerId: "",
        title: "",
        description: "",
        frequency: "weekly",
        startDate: "",
        endDate: "",
        autoRenew: false,
        amount: "",
        billingFrequency: "monthly",
        notes: "",
        terms: "",
        scheduleDays: [],
        hoursPerWeek: "",
        hourlyRate: "",
        annualValue: "",
        employeeIds: [],
      })
      setTaskInputs({})
    }

  const handleCreate = async () => {
    if (!formData.customerId || !formData.title || !formData.frequency || !formData.startDate || !formData.endDate || !formData.amount) {
      toast.error("Please fill in all required fields")
      return
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error("End date cannot be before the start date")
      return
    }

    if (new Date(formData.endDate) < new Date(todayDate)) {
      toast.error("End date cannot be in the past")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(formData.customerId),
          title: formData.title,
          description: formData.description || null,
          frequency: formData.frequency,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          autoRenew: formData.autoRenew,
          amount: parseFloat(formData.amount),
          billingFrequency: formData.billingFrequency,
            notes: formData.notes || null,
            terms: formData.terms || null,
            scheduleDays: formData.scheduleDays,
            hoursPerWeek: weeklyHours > 0 ? weeklyHours : null,
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
            annualValue: formData.annualValue ? parseFloat(formData.annualValue) : null,
            employeeIds: formData.employeeIds,
          }),
        })

      if (!response.ok) throw new Error("Failed to create contract")
      
      const newContract = await response.json()
      toast.success("Contract created successfully")
      setCreateDialogOpen(false)
      resetForm()
      fetchContracts()

      // Send notification email
      await sendContractNotification(newContract.id, "new")
    } catch (error) {
      console.error("Error creating contract:", error)
      toast.error("Failed to create contract")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedContract) return

    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error("End date cannot be before the start date")
      return
    }

    if (formData.endDate && new Date(formData.endDate) < new Date(todayDate)) {
      toast.error("End date cannot be in the past")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          frequency: formData.frequency,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          autoRenew: formData.autoRenew,
          amount: parseFloat(formData.amount),
          billingFrequency: formData.billingFrequency,
            notes: formData.notes || null,
            terms: formData.terms || null,
            scheduleDays: formData.scheduleDays,
            hoursPerWeek: weeklyHours > 0 ? weeklyHours : null,
            hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
            annualValue: formData.annualValue ? parseFloat(formData.annualValue) : null,
            employeeIds: formData.employeeIds,
          }),
        })

      if (!response.ok) throw new Error("Failed to update contract")
      
      toast.success("Contract updated successfully")
      setEditDialogOpen(false)
      fetchContracts()

      // Send notification email
      await sendContractNotification(selectedContract.id, "update")
    } catch (error) {
      console.error("Error updating contract:", error)
      toast.error("Failed to update contract")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contractToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/contracts/${contractToDelete}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete contract")
      
      toast.success("Contract deleted successfully")
      setDeleteDialogOpen(false)
      setContractToDelete(null)
      fetchContracts()
    } catch (error) {
      console.error("Error deleting contract:", error)
      toast.error("Failed to delete contract")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteClick = (contractId: number) => {
    setContractToDelete(contractId)
    setDeleteDialogOpen(true)
  }

  const handleActivateClick = (contract: Contract) => {
    setContractToActivate(contract)
    setActivateDialogOpen(true)
  }

  const handleSendContract = async (contractId: number) => {
    const result = await sendContractNotification(contractId, "update")
    if (result?.success) {
      toast.success("Contract sent to customer")
    } else if (result?.warning) {
      toast.warning(result.warning)
    } else {
      toast.error("Failed to send contract")
    }
  }

  const handleStatusChange = async (contractId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")
      
      toast.success(`Contract ${newStatus}`)
      fetchContracts()

      // Send notification
      const notificationType = newStatus === "cancelled" ? "cancelled" : "update"
      await sendContractNotification(contractId, notificationType)
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    }
  }

  const sendContractNotification = async (contractId: number, type: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send contract")
      }
      return data
    } catch (error) {
      console.error("Error sending notification:", error)
      return { success: false, warning: error instanceof Error ? error.message : "Failed to send contract" }
    }
  }

  const handleViewContract = (contract: Contract) => {
    setSelectedContract(contract)
    setViewDialogOpen(true)
  }

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract)
    setTaskInputs({})
    const normalizedScheduleDays = Array.isArray(contract.scheduleDays)
      ? contract.scheduleDays
          .map((item: any) => {
            if (typeof item === "string") {
              return { day: item, startTime: "09:00", durationMinutes: 120, tasks: [] }
            }
            if (!item?.day) return null
            const tasks = Array.isArray(item.tasks)
              ? item.tasks
                  .filter((task: any) => typeof task === "string" && task.trim().length > 0)
                  .map((task: string) => task.trim())
              : []
            return {
              day: item.day,
              startTime: item.startTime || "09:00",
              durationMinutes: Number.isFinite(item.durationMinutes) ? Number(item.durationMinutes) : 120,
              tasks,
            }
          })
          .filter((day): day is ScheduleDay => Boolean(day))
      : []
    setFormData({
      customerId: contract.customerId.toString(),
      title: contract.title,
      description: contract.description || "",
      frequency: contract.frequency || "weekly",
      startDate: contract.startDate ? contract.startDate.split("T")[0] : "",
      endDate: contract.endDate ? contract.endDate.split("T")[0] : "",
      autoRenew: contract.autoRenew === 1,
      amount: contract.amount,
      billingFrequency: contract.billingFrequency || "monthly",
        notes: contract.notes || "",
        terms: contract.terms || "",
        scheduleDays: normalizedScheduleDays,
        hoursPerWeek: contract.hoursPerWeek || "",
        hourlyRate: contract.hourlyRate || "",
        annualValue: contract.annualValue || "",
        employeeIds: (contract.employeeIds || []).map((id) => id.toString()),
      })
    setEditDialogOpen(true)
  }

  const handleGenerateJobsClick = (contract: Contract) => {
    setSelectedContract(contract)
    setGenerateForm({
      weeksAhead: 4,
      assignedTo: "",
      defaultStartTime: "09:00",
      defaultDurationMinutes: 120,
    })
    setGenerateDialogOpen(true)
  }

  const handleGenerateJobs = async () => {
    if (!selectedContract) return

    if (selectedContract.status !== "active") {
      toast.error("Contract must be active to generate jobs")
      return
    }

    const scheduleDays = selectedContract.scheduleDays || formData.scheduleDays
    if (!scheduleDays || scheduleDays.length === 0) {
      toast.error("Please set schedule days on the contract before generating jobs")
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`/api/contracts/${selectedContract.id}/generate-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weeksAhead: generateForm.weeksAhead,
          assignedTo: generateForm.assignedTo || null,
          scheduleDays: scheduleDays,
          defaultStartTime: generateForm.defaultStartTime,
          defaultDurationMinutes: generateForm.defaultDurationMinutes,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate jobs")
      }

      toast.success(data.message || `Created ${data.created} jobs`)
      setGenerateDialogOpen(false)
    } catch (error) {
      console.error("Error generating jobs:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate jobs")
    } finally {
      setIsGenerating(false)
    }
  }

  // Toggle a schedule day
  const toggleScheduleDay = (day: string) => {
    const existing = formData.scheduleDays.find(d => d.day === day)
    if (existing) {
      setFormData({
        ...formData,
        scheduleDays: formData.scheduleDays.filter(d => d.day !== day)
      })
    } else {
      setFormData({
        ...formData,
        scheduleDays: [...formData.scheduleDays, { day, startTime: "09:00", durationMinutes: 120, tasks: [] }]
      })
    }
  }

  // Update schedule day time
  const updateScheduleDayTime = (day: string, field: "startTime" | "durationMinutes", value: string | number) => {
    setFormData({
      ...formData,
      scheduleDays: formData.scheduleDays.map(d => 
        d.day === day ? { ...d, [field]: value } : d
      )
    })
  }

  const addScheduleDayTask = (day: string) => {
    const value = (taskInputs[day] || "").trim()
    if (!value) return
    setFormData({
      ...formData,
      scheduleDays: formData.scheduleDays.map((d) =>
        d.day === day ? { ...d, tasks: [...(d.tasks || []), value] } : d
      ),
    })
    setTaskInputs((prev) => ({ ...prev, [day]: "" }))
  }

  const removeScheduleDayTask = (day: string, index: number) => {
    setFormData({
      ...formData,
      scheduleDays: formData.scheduleDays.map((d) =>
        d.day === day ? { ...d, tasks: (d.tasks || []).filter((_, i) => i !== index) } : d
      ),
    })
  }

  const handleExportPDF = (contract: Contract) => {
    const doc = new jsPDF()
    const customer = contract.customer
    
    // Header
    doc.setFontSize(20)
    doc.text("SERVICE CONTRACT", 105, 20, { align: "center" })
    
    doc.setFontSize(12)
    doc.text(`Contract Number: ${contract.contractNumber}`, 20, 40)
    
    // Contract details
    doc.setFontSize(14)
    doc.text("Contract Details", 20, 55)
    doc.setFontSize(11)
    doc.text(`Service: ${contract.title}`, 20, 65)
    doc.text(`Description: ${contract.description || "N/A"}`, 20, 72)
    doc.text(`Frequency: ${contract.frequency || "N/A"}`, 20, 79)
    doc.text(`Amount: £${parseFloat(contract.amount).toFixed(2)}`, 20, 86)
    doc.text(`Billing: ${contract.billingFrequency || "Monthly"}`, 20, 93)
    
    // Dates
    doc.text(`Start Date: ${formatDate(contract.startDate)}`, 20, 103)
    doc.text(`End Date: ${contract.endDate ? formatDate(contract.endDate) : "Rolling"}`, 20, 110)
    doc.text(`Auto-Renew: ${contract.autoRenew ? "Yes" : "No"}`, 20, 117)
    doc.text(`Status: ${contract.status.toUpperCase()}`, 20, 124)
    
    // Customer details
    if (customer) {
      doc.setFontSize(14)
      doc.text("Customer Information", 20, 140)
      doc.setFontSize(11)
      doc.text(`Name: ${customer.firstName} ${customer.lastName}`, 20, 150)
      doc.text(`Email: ${customer.email}`, 20, 157)
      if (customer.phone) doc.text(`Phone: ${customer.phone}`, 20, 164)
      if (customer.address) {
        doc.text(`Address: ${customer.address}`, 20, 171)
        doc.text(`${customer.city || ""} ${customer.postcode || ""}`, 20, 178)
      }
    }

    // Terms
    if (contract.terms) {
      doc.setFontSize(14)
      doc.text("Terms & Conditions", 20, 195)
      doc.setFontSize(10)
      const splitTerms = doc.splitTextToSize(contract.terms, 170)
      doc.text(splitTerms, 20, 205)
    }

    // Footer
    doc.setFontSize(9)
    doc.text(`Generated on ${new Date().toLocaleDateString("en-GB")}`, 20, 280)
    
    doc.save(`contract-${contract.contractNumber}.pdf`)
    toast.success("Contract PDF downloaded")
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  // Calculate stats
  const activeContracts = contracts.filter((c) => getContractStatus(c) === "active" || getContractStatus(c) === "expiring")
  const totalMonthlyValue = activeContracts.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0)
  const upcomingRenewals = contracts.filter((c) => {
    const days = calculateDaysUntilEnd(c.endDate)
    return days !== null && days > 0 && days <= 60
  })

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <DashboardHeaderClient />
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeaderClient />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Contracts</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage recurring service contracts and renewals</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Contract</DialogTitle>
              <DialogDescription>Set up a recurring service contract</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.firstName} {c.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Service Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly Office Cleaning"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Service description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency *</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="multiple-times-week">Multiple times a week</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="bi-monthly">Bi-monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hours Per Week</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={weeklyHoursDisplay}
                    placeholder="Calculated"
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assigned Employees</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employees available.</p>
                  ) : (
                    employees.map((emp) => {
                      const checked = formData.employeeIds.includes(emp.id.toString())
                      return (
                        <label
                          key={emp.id}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const isChecked = value === true
                              const next = isChecked
                                ? [...formData.employeeIds, emp.id.toString()]
                                : formData.employeeIds.filter((id) => id !== emp.id.toString())
                              setFormData({ ...formData, employeeIds: next })
                            }}
                          />
                          <span>{emp.firstName} {emp.lastName}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jobs generated from this contract will be assigned round-robin across these employees.
                </p>
              </div>

              {/* Schedule Days Picker */}
              <div className="space-y-3">
                <Label>Schedule Days (select days for recurring jobs)</Label>
                <div className="flex flex-wrap gap-2">
                  {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                    const isSelected = formData.scheduleDays.some(d => d.day === day)
                    return (
                      <Button
                        key={day}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleScheduleDay(day)}
                        className="capitalize"
                      >
                        {day.slice(0, 3)}
                      </Button>
                    )
                  })}
                </div>
                {formData.scheduleDays.length > 0 && (
                  <div className="space-y-2 mt-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Set time and tasks for each day:</p>
                    {formData.scheduleDays.map((scheduleDay) => {
                      const tasks = scheduleDay.tasks || []
                      return (
                        <div key={scheduleDay.day} className="space-y-2 rounded-md border bg-background p-3">
                          <div className="flex items-center gap-3">
                            <span className="w-20 capitalize text-sm font-medium">{scheduleDay.day}</span>
                            <Input
                              type="time"
                              value={scheduleDay.startTime}
                              onChange={(e) => updateScheduleDayTime(scheduleDay.day, "startTime", e.target.value)}
                              className="w-28"
                            />
                            <Select
                              value={scheduleDay.durationMinutes.toString()}
                              onValueChange={(v) => updateScheduleDayTime(scheduleDay.day, "durationMinutes", parseInt(v))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="90">1.5 hours</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                                <SelectItem value="180">3 hours</SelectItem>
                                <SelectItem value="240">4 hours</SelectItem>
                                <SelectItem value="300">5 hours</SelectItem>
                                <SelectItem value="360">6 hours</SelectItem>
                                <SelectItem value="480">8 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No tasks added for this day.</p>
                              ) : (
                                tasks.map((task, index) => (
                                  <span
                                    key={`${scheduleDay.day}-${index}`}
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                                  >
                                    {task}
                                    <button
                                      type="button"
                                      onClick={() => removeScheduleDayTask(scheduleDay.day, index)}
                                      className="rounded-full p-0.5 hover:bg-muted"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={taskInputs[scheduleDay.day] ?? ""}
                                onChange={(e) =>
                                  setTaskInputs((prev) => ({ ...prev, [scheduleDay.day]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    addScheduleDayTask(scheduleDay.day)
                                  }
                                }}
                                placeholder={`Add task for ${scheduleDay.day}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => addScheduleDayTask(scheduleDay.day)}
                                className="sm:w-auto"
                              >
                                Add Task
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    min={getMinEndDate()}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Frequency</Label>
                  <Select value={formData.billingFrequency} onValueChange={(v) => setFormData({ ...formData, billingFrequency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hourly Rate (£) - for employee pay</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    placeholder="e.g., 12.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Annual Value (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.annualValue}
                    onChange={(e) => setFormData({ ...formData, annualValue: e.target.value })}
                    placeholder="e.g., 10550"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.autoRenew}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
                />
                <Label>Auto-renew contract</Label>
              </div>

              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                  placeholder="Contract terms..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Contract
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{contracts.length}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Total Contracts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeContracts.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Pound className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">£{totalMonthlyValue.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Monthly Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Bell className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingRenewals.length}</p>
                <p className="text-sm text-muted-foreground">Renewals Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Renewals Alert */}
      {upcomingRenewals.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Upcoming Renewals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingRenewals.map((contract) => {
                const days = calculateDaysUntilEnd(contract.endDate)
                return (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{contract.customer?.firstName} {contract.customer?.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        {contract.title} - Renewal: {formatDate(contract.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={days && days <= 14 ? "destructive" : "outline"}>
                        {days} days
                      </Badge>
                      <Button size="sm" onClick={() => handleStatusChange(contract.id, "active")}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Renew
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Contracts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        {["all", "active", "expiring", "expired"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">
                <div className="p-4 sm:hidden">
                  {contracts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No contracts found. Create your first contract to get started.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contracts
                        .filter((c) => {
                          const status = getContractStatus(c)
                          if (tab === "all") return true
                          if (tab === "active") return status === "active"
                          if (tab === "expiring") return status === "expiring"
                          if (tab === "expired") return status === "expired" || status === "cancelled"
                          return true
                        })
                        .map((contract) => (
                          <Card key={contract.id} className="border-muted">
                            <CardContent className="p-3 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">{contract.contractNumber}</p>
                                  <p className="font-medium text-sm">{contract.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {contract.customer?.firstName} {contract.customer?.lastName}
                                  </p>
                                </div>
                                {getStatusBadge(getContractStatus(contract))}
                              </div>

                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center justify-between">
                                  <span>Amount</span>
                                  <span className="text-foreground font-medium">£{parseFloat(contract.amount || "0").toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Frequency</span>
                                  <span className="text-foreground">{contract.frequency || "N/A"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Duration</span>
                                  <span>
                                    <span className="text-green-600 font-medium">{formatDate(contract.startDate)}</span>
                                    <span className="text-muted-foreground"> - </span>
                                    <span className="text-red-600 font-medium">{formatDate(contract.endDate)}</span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Auto-renew</span>
                                  <span>{contract.autoRenew ? "Yes" : "No"}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewContract(contract)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewContract(contract)}>
                                      <Eye className="h-4 w-4 mr-2" /> View Contract
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEditContract(contract)}>
                                      <Pencil className="h-4 w-4 mr-2" /> Edit
                                    </DropdownMenuItem>
                                    {contract.status === "draft" && (
                                      <DropdownMenuItem onClick={() => handleActivateClick(contract)}>
                                        <CheckCircle className="h-4 w-4 mr-2" /> Mark as Active
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleSendContract(contract.id)}>
                                      <Send className="h-4 w-4 mr-2" /> Send
                                    </DropdownMenuItem>
                                    {getContractStatus(contract) === "active" && (
                                      <DropdownMenuItem onClick={() => handleGenerateJobsClick(contract)}>
                                        <CalendarPlus className="h-4 w-4 mr-2" /> Generate Jobs
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteClick(contract.id)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  )}
                </div>

                <Table className="hidden sm:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contract</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auto-renew</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts
                      .filter((c) => {
                        const status = getContractStatus(c)
                        if (tab === "all") return true
                        if (tab === "active") return status === "active"
                        if (tab === "expiring") return status === "expiring"
                        if (tab === "expired") return status === "expired" || status === "cancelled"
                        return true
                      })
                      .map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleViewContract(contract)}
                              className="text-left"
                            >
                              <div>
                                <p className="font-medium text-blue-700 hover:underline">{contract.title}</p>
                                <p className="text-sm text-muted-foreground">{contract.contractNumber}</p>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {contract.customer?.firstName} {contract.customer?.lastName}
                              </p>
                              {contract.customer?.email && (
                                <p className="text-sm text-muted-foreground">{contract.customer.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{contract.frequency || "N/A"}</TableCell>
                          <TableCell className="text-right font-medium">
                            £{parseFloat(contract.amount || "0").toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span className="text-green-600 font-medium">{formatDate(contract.startDate)}</span>
                            <span className="text-muted-foreground"> - </span>
                            <span className="text-red-600 font-medium">{formatDate(contract.endDate)}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(getContractStatus(contract))}</TableCell>
                          <TableCell>
                            {contract.autoRenew ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3 mr-1" /> Yes
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewContract(contract)}>
                                    <Eye className="h-4 w-4 mr-2" /> View Contract
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditContract(contract)}>
                                    <Pencil className="h-4 w-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  {contract.status === "draft" && (
                                    <DropdownMenuItem onClick={() => handleActivateClick(contract)}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Mark as Active
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleSendContract(contract.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Send
                                  </DropdownMenuItem>
                                  {getContractStatus(contract) === "active" && (
                                    <DropdownMenuItem onClick={() => handleGenerateJobsClick(contract)}>
                                      <CalendarPlus className="h-4 w-4 mr-2" /> Generate Jobs
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteClick(contract.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                    {contracts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No contracts found. Create your first contract to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* View Contract Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
            <DialogDescription>{selectedContract?.contractNumber}</DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">
                    {selectedContract.customer?.firstName} {selectedContract.customer?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedContract.customer?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(getContractStatus(selectedContract))}</div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Service</Label>
                <p className="font-medium">{selectedContract.title}</p>
                {selectedContract.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedContract.description}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Frequency</Label>
                  <p className="font-medium">{selectedContract.frequency || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium">£{parseFloat(selectedContract.amount).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Billing</Label>
                  <p className="font-medium">{selectedContract.billingFrequency || "Monthly"}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p className="font-medium">{formatDate(selectedContract.startDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">End Date</Label>
                  <p className="font-medium">{selectedContract.endDate ? formatDate(selectedContract.endDate) : "Rolling"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Auto-Renew</Label>
                  <p className="font-medium">{selectedContract.autoRenew ? "Yes" : "No"}</p>
                </div>
              </div>

              {selectedContract.terms && (
                <div>
                  <Label className="text-muted-foreground">Terms & Conditions</Label>
                  <p className="text-sm mt-1">{selectedContract.terms}</p>
                </div>
              )}

              {selectedContract.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1">{selectedContract.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleExportPDF(selectedContract!)}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => handleSendContract(selectedContract!.id)}
            >
              <Mail className="h-4 w-4 mr-2" /> Send to Customer
            </Button>
            <Button onClick={() => {
              setViewDialogOpen(false)
              handleEditContract(selectedContract!)
            }}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>{selectedContract?.contractNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="multiple-times-week">Multiple times a week</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="bi-monthly">Bi-monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="space-y-2">
                <Label>Assigned Employees</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {employees.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No employees available.</p>
                  ) : (
                    employees.map((emp) => {
                      const checked = formData.employeeIds.includes(emp.id.toString())
                      return (
                        <label
                          key={emp.id}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const isChecked = value === true
                              const next = isChecked
                                ? [...formData.employeeIds, emp.id.toString()]
                                : formData.employeeIds.filter((id) => id !== emp.id.toString())
                              setFormData({ ...formData, employeeIds: next })
                            }}
                          />
                          <span>{emp.firstName} {emp.lastName}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jobs generated from this contract will be assigned round-robin across these employees.
                </p>
              </div>

              {/* Schedule Days Picker */}
              <div className="space-y-3">
                <Label>Schedule Days (select days for recurring jobs)</Label>
                <div className="flex flex-wrap gap-2">
                  {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                    const isSelected = formData.scheduleDays.some(d => d.day === day)
                    return (
                      <Button
                        key={day}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleScheduleDay(day)}
                        className="capitalize"
                      >
                        {day.slice(0, 3)}
                      </Button>
                    )
                  })}
                </div>
                {formData.scheduleDays.length > 0 && (
                  <div className="space-y-2 mt-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Set time and tasks for each day:</p>
                    {formData.scheduleDays.map((scheduleDay) => {
                      const tasks = scheduleDay.tasks || []
                      return (
                        <div key={scheduleDay.day} className="space-y-2 rounded-md border bg-background p-3">
                          <div className="flex items-center gap-3">
                            <span className="w-20 capitalize text-sm font-medium">{scheduleDay.day}</span>
                            <Input
                              type="time"
                              value={scheduleDay.startTime}
                              onChange={(e) => updateScheduleDayTime(scheduleDay.day, "startTime", e.target.value)}
                              className="w-28"
                            />
                            <Select
                              value={scheduleDay.durationMinutes.toString()}
                              onValueChange={(v) => updateScheduleDayTime(scheduleDay.day, "durationMinutes", parseInt(v))}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="60">1 hour</SelectItem>
                                <SelectItem value="90">1.5 hours</SelectItem>
                                <SelectItem value="120">2 hours</SelectItem>
                                <SelectItem value="180">3 hours</SelectItem>
                                <SelectItem value="240">4 hours</SelectItem>
                                <SelectItem value="300">5 hours</SelectItem>
                                <SelectItem value="360">6 hours</SelectItem>
                                <SelectItem value="480">8 hours</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {tasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No tasks added for this day.</p>
                              ) : (
                                tasks.map((task, index) => (
                                  <span
                                    key={`${scheduleDay.day}-${index}`}
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                                  >
                                    {task}
                                    <button
                                      type="button"
                                      onClick={() => removeScheduleDayTask(scheduleDay.day, index)}
                                      className="rounded-full p-0.5 hover:bg-muted"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={taskInputs[scheduleDay.day] ?? ""}
                                onChange={(e) =>
                                  setTaskInputs((prev) => ({ ...prev, [scheduleDay.day]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    addScheduleDayTask(scheduleDay.day)
                                  }
                                }}
                                placeholder={`Add task for ${scheduleDay.day}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => addScheduleDayTask(scheduleDay.day)}
                                className="sm:w-auto"
                              >
                                Add Task
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    min={getMinEndDate()}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (£) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Frequency</Label>
                <Select value={formData.billingFrequency} onValueChange={(v) => setFormData({ ...formData, billingFrequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.autoRenew}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
              />
              <Label>Auto-renew contract</Label>
            </div>

            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contract? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Contract as Active?</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm you have reviewed the contract with the customer and they are happy with the terms and conditions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contractToActivate) {
                  handleStatusChange(contractToActivate.id, "active")
                }
                setActivateDialogOpen(false)
                setContractToActivate(null)
              }}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Confirm & Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Jobs Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              Generate Jobs from Contract
            </DialogTitle>
            <DialogDescription>
              Create recurring jobs for {selectedContract?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4 py-4">
              {/* Show schedule days info */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Contract Schedule</p>
                {selectedContract.scheduleDays && selectedContract.scheduleDays.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedContract.scheduleDays.map((d) => (
                      <Badge key={d.day} variant="secondary" className="capitalize">
                        {d.day} at {d.startTime}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No schedule days set. Please edit the contract to set schedule days first.
                  </p>
                )}
              </div>

              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Assigned Employees</p>
                {selectedContract.employeeIds && selectedContract.employeeIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {employees
                      .filter((emp) => selectedContract.employeeIds?.includes(emp.id))
                      .map((emp) => (
                        <Badge key={emp.id} variant="secondary">
                          {emp.firstName} {emp.lastName}
                        </Badge>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No employees selected. Jobs will be created unassigned unless you pick one below.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Generate jobs for how many weeks?</Label>
                <Select 
                  value={generateForm.weeksAhead.toString()} 
                  onValueChange={(v) => setGenerateForm({ ...generateForm, weeksAhead: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 week</SelectItem>
                    <SelectItem value="2">2 weeks</SelectItem>
                    <SelectItem value="4">4 weeks (1 month)</SelectItem>
                    <SelectItem value="8">8 weeks (2 months)</SelectItem>
                    <SelectItem value="12">12 weeks (3 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assign to employee (optional)</Label>
                <Select 
                  value={generateForm.assignedTo || "unassigned"} 
                  onValueChange={(v) =>
                    setGenerateForm({ ...generateForm, assignedTo: v === "unassigned" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Start Time</Label>
                  <Input
                    type="time"
                    value={generateForm.defaultStartTime}
                    onChange={(e) => setGenerateForm({ ...generateForm, defaultStartTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Duration</Label>
                  <Select
                    value={generateForm.defaultDurationMinutes.toString()}
                    onValueChange={(v) => setGenerateForm({ ...generateForm, defaultDurationMinutes: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="300">5 hours</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateJobs} 
              disabled={isGenerating || !selectedContract?.scheduleDays?.length}
            >
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Jobs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  )
}
