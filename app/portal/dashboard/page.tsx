"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter, SheetClose } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Download, LogOut, FileText, CalendarPlus, Sparkles, ClipboardList, Calendar, Clock, Briefcase, Camera, Eye, MapPin, ChevronRight, X, Pencil, Trash2, Building2, Loader2, AlertTriangle, ArrowLeft } from "lucide-react"
import { formatCurrency, getStatusTheme } from "@/lib/utils"
import { downloadInvoicePDF } from "@/lib/pdf-generator"
import { toast } from "sonner"
import { useCustomerSessionTimeout } from "@/hooks/use-session-timeout"

interface Invoice {
  invoice: {
    id: number
    invoiceNumber: string
    total: string
    amountDue: string
    status: string
    issuedAt: Date | null
    dueAt: Date | null
  }
  company: {
    name: string
    email: string
  } | null
}

interface BookingRequest {
  booking: {
    id: number
    serviceType: string
    preferredDate: string | null
    preferredTimeSlot: string | null
    alternateDate: string | null
    status: string
    address: string
    addressLine2: string | null
    city: string | null
    postcode: string | null
    estimatedPrice: string | null
    createdAt: string
    specialRequirements: string | null
    accessInstructions: string | null
    propertyType: string | null
    bedrooms: number | null
    bathrooms: number | null
    frequency: string | null
  }
  company: {
    id: number
    name: string
    email?: string
    phone?: string
  } | null
}

interface CustomerJob {
  id: number
  title: string
  status: string
  scheduledFor: string | null
  location: string | null
  assigneeName: string | null
  photoCount: number
}

interface CustomerContract {
  contract: {
    id: number
    contractNumber: string
    title: string
    description: string | null
    frequency: string | null
    amount: string
    billingFrequency: string | null
    startDate: string | null
    endDate: string | null
    autoRenew: number | null
    status: string
    terms: string | null
    notes: string | null
    signedAt: string | null
  }
  company: {
    id: number
    name: string
    email?: string | null
    phone?: string | null
  } | null
}
const SERVICE_TYPE_LABELS: Record<string, string> = {
  regular: "Regular Cleaning",
  deep_clean: "Deep Cleaning",
  move_in: "Move-In Cleaning",
  move_out: "Move-Out Cleaning",
  one_time: "One-Time Cleaning",
  spring_clean: "Spring Cleaning",
}

const TIME_SLOT_LABELS: Record<string, string> = {
  morning: "Morning (8am - 12pm)",
  afternoon: "Afternoon (12pm - 5pm)",
  evening: "Evening (5pm - 8pm)",
  flexible: "Flexible",
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  quoted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  converted: "bg-green-600 text-white",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: "House",
  apartment: "Apartment",
  flat: "Flat",
  office: "Office",
  studio: "Studio",
  bungalow: "Bungalow",
}

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-Time",
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
}

export default function CustomerDashboardPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bookings, setBookings] = useState<BookingRequest[]>([])
  const [jobs, setJobs] = useState<CustomerJob[]>([])
  const [contracts, setContracts] = useState<CustomerContract[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [sessionWarning, setSessionWarning] = useState(false)
  
  // Booking detail sheet state
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<CustomerContract | null>(null)
  const [isContractDetailOpen, setIsContractDetailOpen] = useState(false)
  const [isSigningContract, setIsSigningContract] = useState<number | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    preferredDate: "",
    preferredTimeSlot: "",
    address: "",
    addressLine2: "",
    city: "",
    postcode: "",
    specialRequirements: "",
    accessInstructions: "",
  })

  // Session timeout - auto logout after 30 minutes of inactivity
  useCustomerSessionTimeout()

  useEffect(() => {
    const customerData = localStorage.getItem("customer_data")
    const token = localStorage.getItem("customer_token")

    if (!customerData || !token) {
      window.location.href = "/portal"
      return
    }

    setCustomer(JSON.parse(customerData))
    fetchInvoices(token)
    fetchBookings(token)
    fetchJobs(token)
    fetchContracts(token)
  }, [])

  const fetchInvoices = async (token: string) => {
    try {
      const response = await fetch("/api/customer-portal/invoices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch invoices")
      }

      const data = await response.json()
      setInvoices(data)
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookings = async (token: string) => {
    try {
      const response = await fetch("/api/customer-portal/bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      }
    } catch (error) {
      console.error("Error fetching bookings:", error)
    }
  }

  const fetchJobs = async (token: string) => {
    try {
      const response = await fetch("/api/customer-portal/jobs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      }
    } catch (error) {
      console.error("Error fetching jobs:", error)
    }
  }

  const fetchContracts = async (token: string) => {
    try {
      const response = await fetch("/api/customer-portal/contracts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setContracts(data)
      }
    } catch (error) {
      console.error("Error fetching contracts:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("customer_token")
    localStorage.removeItem("customer_data")
    window.location.href = "/portal"
  }

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      setDownloadingId(invoiceId)
      
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (!response.ok) {
        throw new Error("Failed to fetch invoice data")
      }
      
      const invoiceData = await response.json()
      downloadInvoicePDF(invoiceData)
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast.error("Failed to download PDF. Please try again.")
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (value: Date | string | null) => {
    if (!value) return "—"
    const date = typeof value === "string" ? new Date(value) : value
    return new Intl.DateTimeFormat("en-GB", { 
      day: "2-digit", 
      month: "short", 
      year: "numeric" 
    }).format(date)
  }

  const handleViewContract = (contract: CustomerContract) => {
    setSelectedContract(contract)
    setIsContractDetailOpen(true)
  }

  const handleSignContract = async (contractId: number) => {
    const token = localStorage.getItem("customer_token")
    if (!token) {
      router.push("/portal")
      return
    }

    setIsSigningContract(contractId)
    try {
      const response = await fetch(`/api/customer-portal/contracts/${contractId}/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error || "Failed to sign contract")
      }

      toast.success("Contract signed and activated")
      fetchContracts(token)
    } catch (error) {
      console.error("Error signing contract:", error)
      toast.error(error instanceof Error ? error.message : "Failed to sign contract")
    } finally {
      setIsSigningContract(null)
    }
  }


  // Open booking detail sheet
  const handleViewBooking = (bookingRequest: BookingRequest) => {
    setSelectedBooking(bookingRequest)
    setIsEditMode(false)
    setEditForm({
      preferredDate: bookingRequest.booking.preferredDate 
        ? new Date(bookingRequest.booking.preferredDate).toISOString().split("T")[0]
        : "",
      preferredTimeSlot: bookingRequest.booking.preferredTimeSlot || "",
      address: bookingRequest.booking.address || "",
      addressLine2: bookingRequest.booking.addressLine2 || "",
      city: bookingRequest.booking.city || "",
      postcode: bookingRequest.booking.postcode || "",
      specialRequirements: bookingRequest.booking.specialRequirements || "",
      accessInstructions: bookingRequest.booking.accessInstructions || "",
    })
    setIsDetailOpen(true)
  }

  // Handle edit booking submission
  const handleEditBooking = async () => {
    if (!selectedBooking) return
    
    const token = localStorage.getItem("customer_token")
    if (!token) {
      router.push("/portal")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/customer-portal/bookings/${selectedBooking.booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "edit",
          preferredDate: editForm.preferredDate || null,
          preferredTimeSlot: editForm.preferredTimeSlot || null,
          address: editForm.address,
          addressLine2: editForm.addressLine2 || null,
          city: editForm.city || null,
          postcode: editForm.postcode || null,
          specialRequirements: editForm.specialRequirements || null,
          accessInstructions: editForm.accessInstructions || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update booking")
      }

      const result = await response.json()
      toast.success("Booking updated successfully!", {
        description: "You'll receive a confirmation email shortly.",
      })

      // Refresh bookings
      fetchBookings(token)
      setIsEditMode(false)
      setIsDetailOpen(false)
    } catch (error) {
      console.error("Error updating booking:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update booking")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle cancel booking
  const handleCancelBooking = async () => {
    if (!selectedBooking) return
    
    const token = localStorage.getItem("customer_token")
    if (!token) {
      router.push("/portal")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/customer-portal/bookings/${selectedBooking.booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "cancel",
          cancellationReason,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to cancel booking")
      }

      toast.success("Booking cancelled", {
        description: "We've sent you a confirmation email.",
      })

      // Refresh bookings
      fetchBookings(token)
      setIsCancelDialogOpen(false)
      setIsDetailOpen(false)
      setCancellationReason("")
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if booking can be modified
  const canModifyBooking = (status: string) => {
    return !["converted", "cancelled", "declined"].includes(status)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + parseFloat(inv.invoice.amountDue || "0"),
    0
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Portal</h1>
            <p className="text-sm text-muted-foreground">Manage your invoices and payments</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push("/portal/book")} className="hidden sm:flex">
              <CalendarPlus className="h-4 w-4 mr-2" />
              Book a Cleaning
            </Button>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{customer?.name || "Customer"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Customer
              </Badge>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {customer?.name ? customer.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "C"}
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Book a Cleaning CTA - Mobile */}
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 sm:hidden">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Need a cleaning?</p>
                <p className="text-sm text-muted-foreground">Book your next service</p>
              </div>
            </div>
            <Button size="sm" onClick={() => router.push("/portal/book")}>
              Book Now
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Booking Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{bookings.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {bookings.filter(b => b.booking.status === "pending").length} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Your Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{jobs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {jobs.filter(j => j.status === "completed").length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totalOutstanding)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {invoices.filter((inv) => inv.invoice.status === "paid").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              My Bookings ({bookings.length})
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              My Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contracts ({contracts.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Booking Requests</CardTitle>
                  <CardDescription className="hidden sm:block">Tap a booking to view details, edit, or cancel</CardDescription>
                </div>
                <Button onClick={() => router.push("/portal/book")} size="sm" className="hidden sm:flex">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  New Booking
                </Button>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No booking requests yet</p>
                    <Button onClick={() => router.push("/portal/book")}>
                      <CalendarPlus className="h-4 w-4 mr-2" />
                      Book Your First Cleaning
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((bookingRequest) => {
                      const { booking, company } = bookingRequest
                      return (
                        <div
                          key={booking.id}
                          onClick={() => handleViewBooking(bookingRequest)}
                          className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          {/* Service Icon */}
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
                            booking.status === "cancelled" 
                              ? "bg-gray-100 dark:bg-gray-800" 
                              : booking.status === "approved" || booking.status === "converted"
                              ? "bg-green-100 dark:bg-green-900"
                              : booking.status === "quoted"
                              ? "bg-purple-100 dark:bg-purple-900"
                              : "bg-primary/10"
                          }`}>
                            <ClipboardList className={`h-5 w-5 ${
                              booking.status === "cancelled"
                                ? "text-gray-500"
                                : booking.status === "approved" || booking.status === "converted"
                                ? "text-green-600"
                                : booking.status === "quoted"
                                ? "text-purple-600"
                                : "text-primary"
                            }`} />
                          </div>

                          {/* Booking Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold truncate">
                                {SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType}
                              </span>
                              <Badge className={`${BOOKING_STATUS_COLORS[booking.status] || "bg-gray-100"} shrink-0 text-xs`}>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </Badge>
                            </div>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              {booking.preferredDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(booking.preferredDate).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short"
                                  })}
                                </span>
                              )}
                              {booking.preferredTimeSlot && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {TIME_SLOT_LABELS[booking.preferredTimeSlot]?.split(" ")[0] || booking.preferredTimeSlot}
                                </span>
                              )}
                              {company && (
                                <span className="flex items-center gap-1 hidden sm:flex">
                                  <Building2 className="h-3.5 w-3.5" />
                                  {company.name}
                                </span>
                              )}
                            </div>

                            {/* Location on second line for mobile */}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {booking.city || booking.address?.substring(0, 25)}
                              </span>
                            </div>
                          </div>

                          {/* Price & Arrow */}
                          <div className="text-right shrink-0">
                            {booking.estimatedPrice && (
                              <div className="font-semibold text-lg">
                                {formatCurrency(parseFloat(booking.estimatedPrice))}
                              </div>
                            )}
                            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto mt-1" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Your Cleaning Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No jobs scheduled yet</p>
                    <p className="text-sm text-muted-foreground">
                      When your booking requests are approved, they'll appear here as scheduled jobs.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Cleaner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Photos</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.title}</TableCell>
                          <TableCell>
                            {job.scheduledFor 
                              ? new Date(job.scheduledFor).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : "—"
                            }
                          </TableCell>
                          <TableCell>{job.location || "—"}</TableCell>
                          <TableCell>{job.assigneeName || "Not assigned"}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={job.status === "completed" ? "default" : "secondary"}
                              className={
                                job.status === "completed" 
                                  ? "bg-green-100 text-green-800" 
                                  : job.status === "in_progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : ""
                              }
                            >
                              {job.status === "in_progress" 
                                ? "In Progress" 
                                : job.status.charAt(0).toUpperCase() + job.status.slice(1)
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Camera className="h-4 w-4 text-muted-foreground" />
                              <span>{job.photoCount}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <Link href={`/portal/jobs/${job.id}/photos`}>
                                <Eye className="h-4 w-4 mr-1" />
                                View Photos
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts">
            <Card>
              <CardHeader>
                <CardTitle>Your Contracts</CardTitle>
                <CardDescription>Review and sign draft contracts from the company</CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No contracts yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map((contractItem) => {
                      const contract = contractItem.contract
                      const statusTheme = getStatusTheme(contract.status)
                      return (
                        <div
                          key={contract.id}
                          className="flex flex-col gap-3 p-4 rounded-lg border bg-card sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{contract.title}</p>
                            <p className="text-xs text-muted-foreground">{contract.contractNumber}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {contract.startDate ? formatDate(contract.startDate) : "N/A"} -{" "}
                              {contract.endDate ? formatDate(contract.endDate) : "Rolling"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusTheme.badgeClass}>{statusTheme.label}</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewContract(contractItem)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            {contract.status === "draft" ? (
                              <Button
                                size="sm"
                                onClick={() => handleSignContract(contract.id)}
                                disabled={isSigningContract === contract.id}
                              >
                                {isSigningContract === contract.id ? "Signing..." : "Sign Contract"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
          <CardHeader>
            <CardTitle>Your Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No invoices found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(({ invoice, company }) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{company?.name || "—"}</TableCell>
                      <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                      <TableCell>{formatDate(invoice.dueAt)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(parseFloat(invoice.total))}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusTheme(invoice.status).badgeClass}>
                          {getStatusTheme(invoice.status).label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(invoice.id)}
                          disabled={downloadingId === invoice.id}
                        >
                          <Download className={`h-4 w-4 ${downloadingId === invoice.id ? 'animate-pulse' : ''}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Booking Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open)
        if (!open) {
          setIsEditMode(false)
          setSelectedBooking(null)
        }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selectedBooking && (
            <div className="flex flex-col min-h-full">
              {/* Mobile Header with Back Button */}
              <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => {
                      if (isEditMode) {
                        setIsEditMode(false)
                      } else {
                        setIsDetailOpen(false)
                      }
                    }}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold truncate">
                      {isEditMode ? "Edit Booking" : "Booking Details"}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate">
                      {isEditMode 
                        ? "Update your booking details"
                        : `#${selectedBooking.booking.id} • ${SERVICE_TYPE_LABELS[selectedBooking.booking.serviceType] || selectedBooking.booking.serviceType}`
                      }
                    </p>
                  </div>
                  <Badge className={`${BOOKING_STATUS_COLORS[selectedBooking.booking.status] || "bg-gray-100"} shrink-0`}>
                    {selectedBooking.booking.status.charAt(0).toUpperCase() + selectedBooking.booking.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Content with proper padding */}
              <div className="flex-1 px-4 py-6 sm:px-6">
              {isEditMode ? (
                /* Edit Form */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="preferredDate">Preferred Date</Label>
                    <Input
                      id="preferredDate"
                      type="date"
                      value={editForm.preferredDate}
                      onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferredTimeSlot">Time Slot</Label>
                    <select
                      id="preferredTimeSlot"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.preferredTimeSlot}
                      onChange={(e) => setEditForm({ ...editForm, preferredTimeSlot: e.target.value })}
                    >
                      <option value="">Select a time slot</option>
                      <option value="morning">Morning (8am - 12pm)</option>
                      <option value="afternoon">Afternoon (12pm - 5pm)</option>
                      <option value="evening">Evening (5pm - 8pm)</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                    <Input
                      id="addressLine2"
                      value={editForm.addressLine2}
                      onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                      placeholder="Apartment, suite, etc."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        value={editForm.postcode}
                        onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialRequirements">Special Requirements</Label>
                    <Textarea
                      id="specialRequirements"
                      value={editForm.specialRequirements}
                      onChange={(e) => setEditForm({ ...editForm, specialRequirements: e.target.value })}
                      placeholder="Any special cleaning requirements..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessInstructions">Access Instructions</Label>
                    <Textarea
                      id="accessInstructions"
                      value={editForm.accessInstructions}
                      onChange={(e) => setEditForm({ ...editForm, accessInstructions: e.target.value })}
                      placeholder="How to access your property..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsEditMode(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleEditBooking}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Detail View */
                <div className="space-y-6">
                  {/* Service Info */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Service Details</h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Service Type</span>
                        <span className="font-medium">{SERVICE_TYPE_LABELS[selectedBooking.booking.serviceType] || selectedBooking.booking.serviceType}</span>
                      </div>
                      {selectedBooking.booking.propertyType && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Property</span>
                          <span className="font-medium">{PROPERTY_TYPE_LABELS[selectedBooking.booking.propertyType] || selectedBooking.booking.propertyType}</span>
                        </div>
                      )}
                      {selectedBooking.booking.frequency && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency</span>
                          <span className="font-medium">{FREQUENCY_LABELS[selectedBooking.booking.frequency] || selectedBooking.booking.frequency}</span>
                        </div>
                      )}
                      {(selectedBooking.booking.bedrooms || selectedBooking.booking.bathrooms) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rooms</span>
                          <span className="font-medium">
                            {selectedBooking.booking.bedrooms && `${selectedBooking.booking.bedrooms} bed`}
                            {selectedBooking.booking.bedrooms && selectedBooking.booking.bathrooms && " • "}
                            {selectedBooking.booking.bathrooms && `${selectedBooking.booking.bathrooms} bath`}
                          </span>
                        </div>
                      )}
                      {selectedBooking.booking.estimatedPrice && (
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-muted-foreground">Estimated Price</span>
                          <span className="font-bold text-lg">{formatCurrency(parseFloat(selectedBooking.booking.estimatedPrice))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Schedule</h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">
                            {selectedBooking.booking.preferredDate 
                              ? new Date(selectedBooking.booking.preferredDate).toLocaleDateString("en-GB", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric"
                                })
                              : "Date not set"
                            }
                          </div>
                          <div className="text-sm text-muted-foreground">Preferred date</div>
                        </div>
                      </div>
                      {selectedBooking.booking.preferredTimeSlot && (
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">{TIME_SLOT_LABELS[selectedBooking.booking.preferredTimeSlot] || selectedBooking.booking.preferredTimeSlot}</div>
                            <div className="text-sm text-muted-foreground">Time slot</div>
                          </div>
                        </div>
                      )}
                      {selectedBooking.booking.alternateDate && (
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-muted-foreground">
                              {new Date(selectedBooking.booking.alternateDate).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short"
                              })}
                            </div>
                            <div className="text-sm text-muted-foreground">Alternate date</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Location</h4>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium">{selectedBooking.booking.address}</div>
                          {selectedBooking.booking.addressLine2 && (
                            <div className="text-muted-foreground">{selectedBooking.booking.addressLine2}</div>
                          )}
                          <div className="text-muted-foreground">
                            {[selectedBooking.booking.city, selectedBooking.booking.postcode].filter(Boolean).join(", ")}
                          </div>
                        </div>
                      </div>
                      {selectedBooking.booking.accessInstructions && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-sm text-muted-foreground mb-1">Access Instructions</div>
                          <div className="text-sm">{selectedBooking.booking.accessInstructions}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company */}
                  {selectedBooking.company && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Cleaning Company</h4>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{selectedBooking.company.name}</div>
                            {selectedBooking.company.email && (
                              <div className="text-sm text-muted-foreground">{selectedBooking.company.email}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Special Requirements */}
                  {selectedBooking.booking.specialRequirements && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Special Requirements</h4>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm">{selectedBooking.booking.specialRequirements}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {canModifyBooking(selectedBooking.booking.status) && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsEditMode(true)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Booking
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => setIsCancelDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancel Booking
                      </Button>
                    </div>
                  )}

                  {/* Warning for non-modifiable bookings */}
                  {!canModifyBooking(selectedBooking.booking.status) && (
                    <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        This booking has been {selectedBooking.booking.status} and can no longer be modified.
                      </p>
                    </div>
                  )}

                  {/* Booking Created Date */}
                  <div className="text-center text-xs text-muted-foreground pt-4 border-t">
                    Booking submitted on {new Date(selectedBooking.booking.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Contract Detail Sheet */}
      <Sheet open={isContractDetailOpen} onOpenChange={setIsContractDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          {selectedContract && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>Contract Details</SheetTitle>
                <SheetDescription>{selectedContract.contract.contractNumber}</SheetDescription>
              </SheetHeader>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={getStatusTheme(selectedContract.contract.status).badgeClass}>
                    {getStatusTheme(selectedContract.contract.status).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service</p>
                  <p className="font-medium">{selectedContract.contract.title}</p>
                </div>
                {selectedContract.contract.description ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedContract.contract.description}</p>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {selectedContract.contract.startDate ? formatDate(selectedContract.contract.startDate) : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {selectedContract.contract.endDate ? formatDate(selectedContract.contract.endDate) : "Rolling"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Frequency</p>
                    <p className="font-medium">{selectedContract.contract.frequency || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(parseFloat(selectedContract.contract.amount || "0"))}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{selectedContract.company?.name || "Company"}</p>
                </div>
              </div>

              <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
                {selectedContract.contract.status === "draft" ? (
                  <Button
                    onClick={() => handleSignContract(selectedContract.contract.id)}
                    disabled={isSigningContract === selectedContract.contract.id}
                  >
                    {isSigningContract === selectedContract.contract.id ? "Signing..." : "Sign Contract"}
                  </Button>
                ) : null}
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Booking Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancel Booking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
              The cleaning company will be notified of your cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-4">
            <Label htmlFor="cancellationReason">Reason for cancellation (optional)</Label>
            <Textarea
              id="cancellationReason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Please let us know why you're cancelling..."
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Keep Booking</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancelBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Booking"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

