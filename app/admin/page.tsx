"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Shield,
  Building2,
  Users,
  Plus,
  LogOut,
  Loader2,
  Eye,
  Trash2,
  Calendar,
  CreditCard,
  Settings,
  LayoutDashboard,
  FileText,
  DollarSign,
  MessageSquare,
  Package,
  Clock,
  Map,
  ClipboardList,
  Truck,
  CheckSquare,
  UserCheck,
  Star,
  Power,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Feature {
  id: number
  name: string
  slug: string
  description: string | null
  type: "company" | "employee"
  price: string
  isCore: boolean | number
  sortOrder: number
}

interface Company {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  subscriptionPlan: string
  subscriptionStatus: string
  numberOfEmployees: number | null
  maxEmployees: number | null
  employeeRate: string | null
  monthlyPlanCost: string | null
  createdAt: string
  employeeCount?: number
  jobCount?: number
  customerCount?: number
}

interface Admin {
  id: number
  email: string
  firstName: string
  lastName: string
}

// Company sections available for company admins
const COMPANY_SECTIONS = [
  { id: "overview", name: "Overview Dashboard", icon: LayoutDashboard, description: "Main dashboard with stats" },
  { id: "scheduling", name: "Scheduling", icon: Calendar, description: "Job scheduling and calendar" },
  { id: "customers", name: "Customers", icon: Users, description: "Customer management" },
  { id: "employees", name: "Employees", icon: UserCheck, description: "Employee management" },
  { id: "jobs", name: "Jobs", icon: ClipboardList, description: "Job management" },
  { id: "quotes", name: "Quotes", icon: FileText, description: "Quote creation and management" },
  { id: "invoices", name: "Invoicing", icon: DollarSign, description: "Invoice management" },
  { id: "payments", name: "Payments", icon: CreditCard, description: "Payment tracking" },
  { id: "contracts", name: "Contracts", icon: FileText, description: "Contract management" },
  { id: "cleaning-plans", name: "Cleaning Plans", icon: CheckSquare, description: "Service packages" },
  { id: "booking-requests", name: "Booking Requests", icon: Package, description: "New booking requests" },
  { id: "messages", name: "Messages", icon: MessageSquare, description: "Internal messaging" },
  { id: "equipment", name: "Equipment", icon: Truck, description: "Equipment inventory" },
  { id: "expenses", name: "Expenses", icon: DollarSign, description: "Expense tracking" },
  { id: "shifts", name: "Shifts", icon: Clock, description: "Shift management" },
  { id: "time-off", name: "Time Off", icon: Calendar, description: "Leave requests" },
  { id: "service-areas", name: "Service Areas", icon: Map, description: "Coverage zones" },
  { id: "feedback", name: "Feedback", icon: Star, description: "Customer feedback" },
  { id: "settings", name: "Settings", icon: Settings, description: "Company settings" },
]

// Employee sections - what employees can access
const EMPLOYEE_SECTIONS = [
  { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, description: "Employee home with today's jobs" },
  { id: "jobs", name: "My Jobs", icon: ClipboardList, description: "View and manage assigned jobs" },
  { id: "check-in", name: "GPS Check-in", icon: Map, description: "Location-based check-in/out" },
  { id: "tasks", name: "Task Completion", icon: CheckSquare, description: "Complete job tasks with photos" },
  { id: "supply-requests", name: "Supply Requests", icon: Package, description: "Request cleaning supplies" },
  { id: "time-off", name: "Time Off Requests", icon: Calendar, description: "Request leave" },
  { id: "messages", name: "Messages", icon: MessageSquare, description: "Communication with office" },
  { id: "profile", name: "Profile", icon: UserCheck, description: "Personal profile settings" },
]

const STEPS = [
  { id: 1, name: "Company", description: "Company details" },
  { id: 2, name: "Admin", description: "Admin account" },
  { id: 3, name: "Features", description: "Select features" },
]

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  
  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1)
  const [features, setFeatures] = useState<{ company: Feature[]; employee: Feature[] }>({ company: [], employee: [] })
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([])
  const [creationFeaturePreset, setCreationFeaturePreset] = useState<"core" | "all" | "custom">("core")
  const [employeeCount, setEmployeeCount] = useState(5)
  const [employeeRate, setEmployeeRate] = useState(20)
  const [validatingEmail, setValidatingEmail] = useState(false)
  const [emailErrors, setEmailErrors] = useState<{ company?: string; admin?: string }>({})

  // Edit features state for existing company
  const [editFeaturesDialogOpen, setEditFeaturesDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editFeatures, setEditFeatures] = useState<Feature[]>([])
  const [editSelectedFeatures, setEditSelectedFeatures] = useState<number[]>([])
  const [editEmployeeCount, setEditEmployeeCount] = useState(5)
  const [editEmployeeRate, setEditEmployeeRate] = useState(20)
  const [savingFeatures, setSavingFeatures] = useState(false)
  const [loadingFeatures, setLoadingFeatures] = useState(false)
  const [featurePreset, setFeaturePreset] = useState<"core" | "all" | "custom">("core")
  const [viewFeatures, setViewFeatures] = useState<Feature[]>([])
  const [viewFeaturesLoading, setViewFeaturesLoading] = useState(false)
  const [planTotalInput, setPlanTotalInput] = useState("0.00")
  const [planTotalOverride, setPlanTotalOverride] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Company details
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    // Step 2: Admin account
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminPassword: "",
  })

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/session")
      if (!res.ok) {
        router.push("/admin/login")
        return
      }
      const data = await res.json()
      setAdmin(data.admin)
    } catch {
      router.push("/admin/login")
    }
  }, [router])

  const loadCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/companies")
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
      }
    } catch {
      toast.error("Failed to load companies")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/features")
      if (res.ok) {
        const data = await res.json()
          if (data.success) {
            setFeatures({ company: data.data.company, employee: data.data.employee })
            // Pre-select core features
            const coreFeatureIds = [...data.data.company, ...data.data.employee]
              .filter((f: Feature) => f.isCore === true || f.isCore === 1)
              .map((f: Feature) => f.id)
            setSelectedFeatures(coreFeatureIds)
            setCreationFeaturePreset("core")
          }
        }
    } catch {
      console.error("Failed to load features")
    }
  }, [])

  useEffect(() => {
    checkAuth()
    loadCompanies()
    loadFeatures()
  }, [checkAuth, loadCompanies, loadFeatures])

  // Calculate pricing
  const pricing = useMemo(() => {
    const companyFeatureCost = features.company
      .filter(f => selectedFeatures.includes(f.id))
      .reduce((sum, f) => sum + parseFloat(f.price), 0)
    
    const employeeFeatureCost = features.employee
      .filter(f => selectedFeatures.includes(f.id))
      .reduce((sum, f) => sum + parseFloat(f.price), 0)
    
    const perEmployeeCost = employeeFeatureCost + employeeRate
    const totalEmployeeCost = perEmployeeCost * employeeCount
    const totalMonthlyCost = companyFeatureCost + totalEmployeeCost

    return {
      companyFeatureCost,
      employeeFeatureCost,
      perEmployeeCost,
      totalEmployeeCost,
      totalMonthlyCost,
      selectedCount: selectedFeatures.length,
    }
  }, [features, selectedFeatures, employeeCount, employeeRate])

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" })
    router.push("/admin/login")
  }

  const validateEmails = async (checkCompanyOnly = false) => {
    setValidatingEmail(true)
    setEmailErrors({})
    
    try {
      const res = await fetch("/api/admin/companies/validate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyEmail: formData.email,
          adminEmail: checkCompanyOnly ? undefined : formData.adminEmail,
        }),
      })
      
      const data = await res.json()
      
      if (!data.valid) {
        setEmailErrors(data.errors || {})
        return false
      }
      
      return true
    } catch {
      toast.error("Failed to validate emails")
      return false
    } finally {
      setValidatingEmail(false)
    }
  }

  const handleNextStep = async () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.email) {
        toast.error("Please fill in required fields")
        return
      }
      
      // Validate company email before proceeding to step 2
      const isValid = await validateEmails(true)
      if (!isValid) {
        return
      }
    }
    
    if (currentStep === 2) {
      if (!formData.adminFirstName || !formData.adminLastName || !formData.adminEmail || !formData.adminPassword) {
        toast.error("Please fill in all admin fields")
        return
      }
      if (formData.adminPassword.length < 8) {
        toast.error("Password must be at least 8 characters")
        return
      }
      
      // Validate both emails before proceeding to step 3
      const isValid = await validateEmails()
      if (!isValid) {
        return
      }
    }
    
    setCurrentStep(prev => Math.min(prev + 1, 3))
  }

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const toggleFeature = (featureId: number, isCore: boolean | number) => {
    if (isCore === true || isCore === 1) return // Can't toggle core features
    
    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    )
    setCreationFeaturePreset("custom")
  }

  const selectCreationCoreFeatures = () => {
    const coreIds = [...features.company, ...features.employee]
      .filter(f => f.isCore === true || f.isCore === 1)
      .map(f => f.id)
    setSelectedFeatures(coreIds)
    setCreationFeaturePreset("core")
  }

  const selectCreationAllFeatures = () => {
    const allIds = [...features.company, ...features.employee].map(f => f.id)
    setSelectedFeatures(allIds)
    setCreationFeaturePreset("all")
  }

  const handleCreateCompany = async () => {
    setCreating(true)

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          selectedFeatures,
          maxEmployees: employeeCount,
          employeeRate,
          monthlyPlanCost: pricing.totalMonthlyCost,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Company created successfully!")
        setCreateDialogOpen(false)
        resetForm()
        loadCompanies()
      } else {
        toast.error(data.error || "Failed to create company")
      }
    } catch {
      toast.error("Failed to create company")
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postcode: "",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
      adminPassword: "",
    })
    setCurrentStep(1)
    setEmployeeCount(5)
    setEmployeeRate(20)
    setEmailErrors({})
    // Reset to core features only
    const coreFeatureIds = [...features.company, ...features.employee]
      .filter(f => f.isCore === true || f.isCore === 1)
      .map(f => f.id)
    setSelectedFeatures(coreFeatureIds)
    setCreationFeaturePreset("core")
  }

  const handleDeleteCompany = async (companyId: number) => {
    if (!confirm("Are you sure? This will delete all company data permanently.")) return

    setDeleting(companyId)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Company deleted")
        loadCompanies()
      } else {
        toast.error("Failed to delete company")
      }
    } catch {
      toast.error("Failed to delete company")
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleCompany = async (companyId: number, currentStatus: string) => {
    const isCurrentlyActive = currentStatus === 'active' || currentStatus === 'trial'
    const action = isCurrentlyActive ? 'suspend' : 'activate'
    
    if (!confirm(`Are you sure you want to ${action} this company?`)) return

    try {
      const res = await fetch(`/api/admin/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: 'set-company-status', 
          isActive: !isCurrentlyActive 
        }),
      })
      if (res.ok) {
        toast.success(`Company ${action}d`)
        loadCompanies()
      } else {
        toast.error(`Failed to ${action} company`)
      }
    } catch {
      toast.error("Operation failed")
    }
  }

  const loadViewFeatures = async (companyId: number) => {
    setViewFeaturesLoading(true)
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/features`)
      if (res.ok) {
        const data = await res.json()
        setViewFeatures(data.data.features)
      } else {
        toast.error("Failed to load company features")
      }
    } catch {
      toast.error("Failed to load company features")
    } finally {
      setViewFeaturesLoading(false)
    }
  }

  const viewCompanyDetails = (company: Company) => {
    setSelectedCompany(company)
    setViewDialogOpen(true)
    loadViewFeatures(company.id)
  }

  const handleViewDialogChange = (open: boolean) => {
    setViewDialogOpen(open)
    if (!open) {
      setSelectedCompany(null)
      setViewFeatures([])
    }
  }

  const openEditFeatures = async (company: Company) => {
    setEditingCompany(company)
    setEditFeaturesDialogOpen(true)
    setLoadingFeatures(true)
    
    try {
      const res = await fetch(`/api/admin/companies/${company.id}/features`)
      if (res.ok) {
        const data = await res.json()
        setEditFeatures(data.data.features)
        const enabledIds = data.data.features
          .filter((f: Feature & { isEnabled: boolean }) => f.isEnabled)
          .map((f: Feature) => f.id)
        setEditSelectedFeatures(enabledIds)
        const coreIds = data.data.features
          .filter(f => f.isCore === true || f.isCore === 1)
          .map(f => f.id)
        const allIds = data.data.features.map((f: Feature) => f.id)
        if (enabledIds.length === coreIds.length && coreIds.every(id => enabledIds.includes(id))) {
          setFeaturePreset("core")
        } else if (enabledIds.length === allIds.length) {
          setFeaturePreset("all")
        } else {
          setFeaturePreset("custom")
        }
        setEditEmployeeCount(data.data.company.maxEmployees || 5)
        setEditEmployeeRate(parseFloat(data.data.company.employeeRate) || 20)
        setPlanTotalOverride(false)
      } else {
        toast.error("Failed to load company features")
      }
    } catch {
      toast.error("Failed to load company features")
    } finally {
      setLoadingFeatures(false)
    }
  }

  const toggleEditFeature = (featureId: number, isCore: boolean | number) => {
    if (isCore === true || isCore === 1) return
    
    setEditSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    )
    setFeaturePreset("custom")
  }

  const selectCoreFeatures = () => {
    const coreIds = editFeatures
      .filter(f => f.isCore === true || f.isCore === 1)
      .map(f => f.id)
    setEditSelectedFeatures(coreIds)
    setFeaturePreset("core")
  }

  const selectAllFeatures = () => {
    const allIds = editFeatures.map(f => f.id)
    setEditSelectedFeatures(allIds)
    setFeaturePreset("all")
  }

  const calculateEditMonthlyCost = useMemo(() => {
    const companyFeaturesCost = editFeatures
      .filter(f => f.type === 'company' && editSelectedFeatures.includes(f.id))
      .reduce((sum, f) => sum + parseFloat(f.price), 0)
    
    const employeeFeaturesCost = editFeatures
      .filter(f => f.type === 'employee' && editSelectedFeatures.includes(f.id))
      .reduce((sum, f) => sum + parseFloat(f.price), 0)
    
    const totalEmployeeCost = employeeFeaturesCost * editEmployeeCount
    const employeeBaseCost = editEmployeeRate * editEmployeeCount
    
    return {
      companyFeatures: companyFeaturesCost,
      employeeFeatures: totalEmployeeCost,
      employeeBase: employeeBaseCost,
      total: companyFeaturesCost + totalEmployeeCost + employeeBaseCost,
    }
  }, [editFeatures, editSelectedFeatures, editEmployeeCount, editEmployeeRate])

  useEffect(() => {
    if (!planTotalOverride) {
      setPlanTotalInput(calculateEditMonthlyCost.total.toFixed(2))
    }
  }, [calculateEditMonthlyCost.total, planTotalOverride])

  const planTotalValue = Number(planTotalInput)
  const resolvedPlanTotal = Number.isFinite(planTotalValue)
    ? planTotalValue
    : calculateEditMonthlyCost.total

  const handleSaveFeatures = async (sendEmail: boolean = false) => {
    if (!editingCompany) return
    
    setSavingFeatures(true)
    try {
      const res = await fetch(`/api/admin/companies/${editingCompany.id}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedFeatures: editSelectedFeatures,
          maxEmployees: editEmployeeCount,
          employeeRate: editEmployeeRate,
          monthlyPlanCost: resolvedPlanTotal,
          sendEmail,
        }),
      })
      
      if (res.ok) {
        toast.success(sendEmail ? "Features updated and email sent" : "Features updated successfully")
        setEditFeaturesDialogOpen(false)
        loadCompanies()
      } else {
        toast.error("Failed to update features")
      }
    } catch {
      toast.error("Failed to update features")
    } finally {
      setSavingFeatures(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
      case "trial":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Trial</Badge>
      case "suspended":
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Suspended</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                {admin?.firstName} {admin?.lastName}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{companies.length}</p>
                  <p className="text-sm text-muted-foreground">Total Companies</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {companies.reduce((sum, c) => sum + (Number(c.employeeCount) || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <CreditCard className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {companies.filter((c) => c.subscriptionStatus === "active" && c.subscriptionPlan !== "trial").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Paid Subscriptions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(companies.reduce((sum, c) => sum + parseFloat(c.monthlyPlanCost || "0"), 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Companies</CardTitle>
              <CardDescription>Manage all cleaning businesses</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={(open) => {
              setCreateDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                  <DialogDescription>
                    Set up a new cleaning business with their features and pricing
                  </DialogDescription>
                </DialogHeader>

                {/* Step Indicator */}
                <div className="py-4">
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, index) => (
                      <div key={step.id} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                            currentStep === step.id 
                              ? "border-primary bg-primary text-primary-foreground"
                              : currentStep > step.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/30 text-muted-foreground"
                          }`}>
                            {currentStep > step.id ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <span className="font-medium">{step.id}</span>
                            )}
                          </div>
                          <div className="mt-2 text-center">
                            <p className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                              {step.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                        {index < STEPS.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-2 mt-[-24px] ${
                            currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1: Company Details */}
                {currentStep === 1 && (
                  <div className="space-y-4 py-4">
                    <h4 className="font-medium">Company Details</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Company Name *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Sparkle Cleaning Co."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company Email *</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value })
                            setEmailErrors(prev => ({ ...prev, company: undefined }))
                          }}
                          placeholder="info@company.com"
                          className={emailErrors.company ? "border-red-500" : ""}
                        />
                        {emailErrors.company && (
                          <p className="text-sm text-red-500">{emailErrors.company}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+44 20 1234 5678"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="123 High Street"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="London"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postcode</Label>
                        <Input
                          value={formData.postcode}
                          onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                          placeholder="SW1A 1AA"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Admin Account */}
                {currentStep === 2 && (
                  <div className="space-y-4 py-4">
                    <h4 className="font-medium">Admin Account</h4>
                    <p className="text-sm text-muted-foreground">
                      Create the company administrator account. They will receive login credentials via email.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={formData.adminFirstName}
                          onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                          placeholder="John"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={formData.adminLastName}
                          onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                          placeholder="Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Admin Email *</Label>
                        <Input
                          type="email"
                          value={formData.adminEmail}
                          onChange={(e) => {
                            setFormData({ ...formData, adminEmail: e.target.value })
                            setEmailErrors(prev => ({ ...prev, admin: undefined }))
                          }}
                          placeholder="admin@company.com"
                          className={emailErrors.admin ? "border-red-500" : ""}
                        />
                        {emailErrors.admin && (
                          <p className="text-sm text-red-500">{emailErrors.admin}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Password *</Label>
                        <Input
                          type="password"
                          value={formData.adminPassword}
                          onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                          placeholder="••••••••"
                          minLength={8}
                        />
                        <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Feature Selection */}
                {currentStep === 3 && (
                  <div className="space-y-6 py-4">
                    {/* Employee Configuration */}
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <h4 className="font-medium mb-4">Employee Configuration</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Maximum Employees</Label>
                          <Input
                            type="number"
                            min={1}
                            value={employeeCount}
                            onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 1)}
                          />
                          <p className="text-xs text-muted-foreground">Number of employee accounts allowed</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Per-Employee Rate (£/month)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={employeeRate}
                            onChange={(e) => setEmployeeRate(parseFloat(e.target.value) || 0)}
                          />
                          <p className="text-xs text-muted-foreground">Base rate charged per employee</p>
                        </div>
                      </div>
                    </div>

                    {/* Company Features */}
                    <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Company Features</h4>
                      <div className="flex gap-1 rounded-full border border-slate-200 bg-white px-1 py-1">
                        <Button
                          variant={creationFeaturePreset === "core" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                          onClick={selectCreationCoreFeatures}
                        >
                          Core Only
                        </Button>
                        <Button
                          variant={creationFeaturePreset === "all" ? "default" : "ghost"}
                          size="sm"
                          className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                          onClick={selectCreationAllFeatures}
                        >
                          Select All
                        </Button>
                      </div>
                    </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {features.company.map((feature) => (
                          <div
                            key={feature.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedFeatures.includes(feature.id)
                                ? "bg-primary/5 border-primary"
                                : "bg-white hover:bg-muted/30"
                            } ${(feature.isCore === true || feature.isCore === 1) ? "opacity-80" : ""}`}
                            onClick={() => toggleFeature(feature.id, feature.isCore)}
                          >
                            <Checkbox
                              checked={selectedFeatures.includes(feature.id)}
                              disabled={feature.isCore === true || feature.isCore === 1}
                              className="pointer-events-none"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{feature.name}</p>
                                {(feature.isCore === true || feature.isCore === 1) && (
                                  <Badge variant="secondary" className="text-xs shrink-0">Core</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-medium ${parseFloat(feature.price) === 0 ? "text-green-600" : ""}`}>
                                {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                              </p>
                              <p className="text-xs text-muted-foreground">/month</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Employee Features */}
                    <div>
                      <h4 className="font-medium mb-3">Employee Features (per employee)</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {features.employee.map((feature) => (
                          <div
                            key={feature.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedFeatures.includes(feature.id)
                                ? "bg-primary/5 border-primary"
                                : "bg-white hover:bg-muted/30"
                            } ${(feature.isCore === true || feature.isCore === 1) ? "opacity-80" : ""}`}
                            onClick={() => toggleFeature(feature.id, feature.isCore)}
                          >
                            <Checkbox
                              checked={selectedFeatures.includes(feature.id)}
                              disabled={feature.isCore === true || feature.isCore === 1}
                              className="pointer-events-none"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{feature.name}</p>
                                {(feature.isCore === true || feature.isCore === 1) && (
                                  <Badge variant="secondary" className="text-xs shrink-0">Core</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`font-medium ${parseFloat(feature.price) === 0 ? "text-green-600" : ""}`}>
                                {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                              </p>
                              <p className="text-xs text-muted-foreground">/emp/mo</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pricing Summary */}
                    <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                      <h4 className="font-medium mb-4">Monthly Plan Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Company Features</span>
                          <span>{formatCurrency(pricing.companyFeatureCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Per-Employee ({employeeCount} × {formatCurrency(pricing.perEmployeeCost)})
                          </span>
                          <span>{formatCurrency(pricing.totalEmployeeCost)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pl-4">
                          <span>Base rate: {formatCurrency(employeeRate)} × {employeeCount}</span>
                          <span>{formatCurrency(employeeRate * employeeCount)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pl-4">
                          <span>Employee features: {formatCurrency(pricing.employeeFeatureCost)} × {employeeCount}</span>
                          <span>{formatCurrency(pricing.employeeFeatureCost * employeeCount)}</span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between font-medium text-lg">
                            <span>Total Monthly Cost</span>
                            <span className="text-primary">{formatCurrency(pricing.totalMonthlyCost)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <DialogFooter className="gap-2">
                  {currentStep > 1 && (
                    <Button type="button" variant="outline" onClick={handlePrevStep}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                  )}
                  {currentStep < 3 ? (
                    <Button 
                      onClick={handleNextStep} 
                      disabled={validatingEmail || !!emailErrors.company || !!emailErrors.admin}
                    >
                      {validatingEmail ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button onClick={handleCreateCompany} disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Create Company
                        </>
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {companies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No companies yet</p>
                <p className="text-sm">Create your first company to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stats</TableHead>
                    <TableHead>Monthly Cost</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">{company.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(company.subscriptionStatus)}</TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          <p>{company.employeeCount || 0} / {company.maxEmployees || 5} employees</p>
                          <p>{company.customerCount || 0} customers</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{formatCurrency(parseFloat(company.monthlyPlanCost || "0"))}</p>
                        <p className="text-xs text-muted-foreground">/month</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(company.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => viewCompanyDetails(company)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditFeatures(company)}
                            title="Manage features"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleCompany(company.id, company.subscriptionStatus)}
                            title={company.subscriptionStatus === 'suspended' ? 'Activate' : 'Suspend'}
                            className={company.subscriptionStatus === 'suspended' 
                              ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                              : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCompany(company.id)}
                            disabled={deleting === company.id}
                            className="text-destructive hover:text-destructive"
                            title="Delete company"
                          >
                            {deleting === company.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Company Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={handleViewDialogChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedCompany?.name}
            </DialogTitle>
            <DialogDescription>Company sections and employee access</DialogDescription>
          </DialogHeader>
            <Tabs defaultValue="company" className="mt-4" id="company-sections-tabs">
              <TabsList>
                <TabsTrigger value="company" id="tab-company">Company Features</TabsTrigger>
                <TabsTrigger value="employee" id="tab-employee">Employee Features</TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="mt-4" id="content-company">
                {viewFeaturesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(viewFeatures.filter(f => f.type === 'company')).length === 0 && (
                      <p className="text-sm text-muted-foreground">No company-specific features configured.</p>
                    )}
                    {viewFeatures
                      .filter(f => f.type === 'company')
                      .map((feature) => (
                        <div
                          key={`company-${feature.id}`}
                          className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{feature.name}</p>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                feature.isEnabled
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }`}
                            >
                              {feature.isEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{feature.description || "No description"}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Price</span>
                            <span>
                              {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                              <span className="ml-1 text-[10px] text-muted-foreground">/month</span>
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="employee" className="mt-4" id="content-employee">
                {viewFeaturesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(viewFeatures.filter(f => f.type === 'employee')).length === 0 && (
                      <p className="text-sm text-muted-foreground">No employee-level features configured.</p>
                    )}
                    {viewFeatures
                      .filter(f => f.type === 'employee')
                      .map((feature) => (
                        <div
                          key={`employee-${feature.id}`}
                          className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{feature.name}</p>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                feature.isEnabled
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-700 border-red-200"
                              }`}
                            >
                              {feature.isEnabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{feature.description || "No description"}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Price</span>
                            <span>
                              {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                              <span className="ml-1 text-[10px] text-muted-foreground">/emp/mo</span>
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {selectedCompany && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium mb-3">Company Info</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{selectedCompany.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{selectedCompany.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span>{getStatusBadge(selectedCompany.subscriptionStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employees:</span>
                    <span>{selectedCompany.employeeCount || 0} / {selectedCompany.maxEmployees || 5}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Cost:</span>
                    <span className="font-medium">{formatCurrency(parseFloat(selectedCompany.monthlyPlanCost || "0"))}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Features Dialog */}
        <Dialog open={editFeaturesDialogOpen} onOpenChange={setEditFeaturesDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Manage Features - {editingCompany?.name}
              </DialogTitle>
              <DialogDescription>
                Enable or disable features and update pricing for this company
              </DialogDescription>
            </DialogHeader>

            {loadingFeatures ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6 mt-4">
                {/* Employee Count & Rate */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Max Employees</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editEmployeeCount}
                      onChange={(e) => setEditEmployeeCount(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Employee Rate (£/month)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editEmployeeRate}
                      onChange={(e) => setEditEmployeeRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Company Features */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Company Features</h4>
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                      <Button
                        variant={featurePreset === "core" ? "default" : "ghost"}
                        size="sm"
                        className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                        onClick={selectCoreFeatures}
                      >
                        Core Only
                      </Button>
                      <Button
                        variant={featurePreset === "all" ? "default" : "ghost"}
                        size="sm"
                        className="rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                        onClick={selectAllFeatures}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {editFeatures
                      .filter(f => f.type === 'company')
                      .map((feature) => (
                        <div
                          key={feature.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            editSelectedFeatures.includes(feature.id)
                              ? "bg-primary/5 border-primary"
                              : "bg-white hover:bg-muted/30"
                          } ${(feature.isCore === true || feature.isCore === 1) ? "opacity-80" : ""}`}
                          onClick={() => toggleEditFeature(feature.id, feature.isCore)}
                        >
                          <Checkbox
                            checked={editSelectedFeatures.includes(feature.id)}
                            disabled={feature.isCore === true || feature.isCore === 1}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{feature.name}</p>
                              {(feature.isCore === true || feature.isCore === 1) && (
                                <Badge variant="secondary" className="text-xs shrink-0">Core</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-medium ${parseFloat(feature.price) === 0 ? "text-green-600" : ""}`}>
                              {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                            </p>
                            <p className="text-xs text-muted-foreground">/month</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Employee Features */}
                <div>
                  <h4 className="font-medium mb-3">Employee Features (per employee)</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {editFeatures
                      .filter(f => f.type === 'employee')
                      .map((feature) => (
                        <div
                          key={feature.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            editSelectedFeatures.includes(feature.id)
                              ? "bg-primary/5 border-primary"
                              : "bg-white hover:bg-muted/30"
                          } ${(feature.isCore === true || feature.isCore === 1) ? "opacity-80" : ""}`}
                          onClick={() => toggleEditFeature(feature.id, feature.isCore)}
                        >
                          <Checkbox
                            checked={editSelectedFeatures.includes(feature.id)}
                            disabled={feature.isCore === true || feature.isCore === 1}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{feature.name}</p>
                              {(feature.isCore === true || feature.isCore === 1) && (
                                <Badge variant="secondary" className="text-xs shrink-0">Core</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{feature.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-medium ${parseFloat(feature.price) === 0 ? "text-green-600" : ""}`}>
                              {parseFloat(feature.price) === 0 ? "Free" : formatCurrency(parseFloat(feature.price))}
                            </p>
                            <p className="text-xs text-muted-foreground">/emp/mo</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Pricing Summary */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-3">Updated Monthly Pricing</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company features:</span>
                        <span>{formatCurrency(calculateEditMonthlyCost.companyFeatures)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employee base ({editEmployeeCount} × £{editEmployeeRate}):</span>
                        <span>{formatCurrency(calculateEditMonthlyCost.employeeBase)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employee features ({editEmployeeCount} employees):</span>
                        <span>{formatCurrency(calculateEditMonthlyCost.employeeFeatures)}</span>
                      </div>
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex justify-between font-medium text-base">
                        <span>Total Monthly Cost:</span>
                        <span className="text-primary">
                          {formatCurrency(resolvedPlanTotal)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={planTotalInput}
                          onChange={(e) => {
                            setPlanTotalOverride(true)
                            setPlanTotalInput(e.target.value)
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPlanTotalOverride(false)}
                          disabled={!planTotalOverride}
                          className="whitespace-nowrap"
                        >
                          Use calculated ({formatCurrency(calculateEditMonthlyCost.total)})
                        </Button>
                      </div>
                      {planTotalOverride && (
                        <p className="text-xs text-muted-foreground">
                          Calculated: {formatCurrency(calculateEditMonthlyCost.total)}
                        </p>
                      )}
                    </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <DialogFooter className="gap-4 mt-4 border-t border-slate-200 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditFeaturesDialogOpen(false)}
                disabled={savingFeatures}
                className="min-w-[110px]"
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSaveFeatures(true)}
                disabled={savingFeatures || loadingFeatures}
                className="min-w-[140px]"
              >
                {savingFeatures ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Save & Notify
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSaveFeatures(false)}
                disabled={savingFeatures || loadingFeatures}
                className="min-w-[140px]"
              >
                {savingFeatures ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
