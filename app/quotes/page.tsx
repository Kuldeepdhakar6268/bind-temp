"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  FileSignature,
  Plus,
  Send,
  Eye,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Trash2,
  KeyRound as Pound,
  TrendingUp,
  Calculator,
  MoreHorizontal,
  RefreshCw,
  ArrowUpRight,
  Search,
  Mail,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
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

interface QuoteItem {
  id?: number
  title: string
  description?: string
  quantity: number
  unitPrice: number
  amount: number
}

interface Quote {
  id: number
  quoteNumber: string
  title: string
  description?: string
  status: string
  total: string
  subtotal: string
  taxRate?: string
  taxAmount?: string
  discountAmount?: string
  validUntil?: string
  sentAt?: string
  createdAt: string
  isExpired?: boolean
  daysSinceSent?: number
  customer?: {
    id: number
    name: string
    email?: string
  }
  items: QuoteItem[]
}

interface Customer {
  id: number
  name: string
  email?: string
  firstName?: string
  lastName?: string
}

interface QuoteSummary {
  total: number
  draft: number
  sent: number
  accepted: number
  rejected: number
  converted: number
  totalValue: number
  acceptedValue: number
  pendingValue: number
}

function getStatusBadge(status: string, isExpired?: boolean) {
  if (isExpired && status === "sent") {
    return (
      <Badge variant="outline" className="text-red-600 border-red-200">
        <AlertCircle className="h-3 w-3 mr-1" /> Expired
      </Badge>
    )
  }
  
  switch (status) {
    case "accepted":
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" /> Accepted
        </Badge>
      )
    case "sent":
    case "pending":
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-200">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>
      )
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" /> Rejected
        </Badge>
      )
    case "draft":
      return (
        <Badge variant="secondary">
          <FileText className="h-3 w-3 mr-1" /> Draft
        </Badge>
      )
    case "converted":
      return (
        <Badge className="bg-blue-500">
          <ArrowUpRight className="h-3 w-3 mr-1" /> Converted
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [summary, setSummary] = useState<QuoteSummary | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Create quote dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState("")
  const [quoteTitle, setQuoteTitle] = useState("")
  const [quoteDescription, setQuoteDescription] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("Payment due within 14 days of acceptance. Work to be scheduled at mutual convenience.")
  const [taxRate, setTaxRate] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [lineItems, setLineItems] = useState<QuoteItem[]>([
    { title: "", description: "", quantity: 1, unitPrice: 0, amount: 0 }
  ])
  const [isSaving, setIsSaving] = useState(false)

  // View quote dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null)

  // Delete quote dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quoteToDelete, setQuoteToDelete] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [infoDialogTitle, setInfoDialogTitle] = useState("")
  const [infoDialogMessage, setInfoDialogMessage] = useState("")

  const fetchQuotes = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (searchQuery) params.set("search", searchQuery)
      
      const res = await fetch(`/api/quotes?${params}`)
      if (!res.ok) throw new Error("Failed to fetch quotes")
      
      const data = await res.json()
      setQuotes(data.quotes || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error("Error fetching quotes:", error)
      toast.error("Failed to load quotes")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery])

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?limit=100")
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || data || [])
      }
    } catch (error) {
      console.error("Error fetching customers:", error)
    }
  }

  useEffect(() => {
    fetchQuotes()
    fetchCustomers()
  }, [fetchQuotes])

  const addLineItem = () => {
    setLineItems([...lineItems, { title: "", description: "", quantity: 1, unitPrice: 0, amount: 0 }])
  }

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index))
    }
  }

  const updateLineItem = (index: number, field: keyof QuoteItem, value: string | number) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    if (field === "quantity" || field === "unitPrice") {
      updated[index].amount = Number(updated[index].quantity) * Number(updated[index].unitPrice)
    }
    setLineItems(updated)
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount - discountAmount

  const resetForm = () => {
    setSelectedCustomer("")
    setQuoteTitle("")
    setQuoteDescription("")
    setValidUntil("")
    setNotes("")
    setTaxRate(0)
    setDiscountAmount(0)
    setLineItems([{ title: "", description: "", quantity: 1, unitPrice: 0, amount: 0 }])
  }

  const handleCreateQuote = async (sendImmediately: boolean = false) => {
    console.log("handleCreateQuote called, sendImmediately:", sendImmediately)
    console.log("selectedCustomer:", selectedCustomer)
    console.log("quoteTitle:", quoteTitle)
    console.log("lineItems:", lineItems)
    
    if (!selectedCustomer || !quoteTitle || lineItems.some(item => !item.title)) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSaving(true)
    try {
      console.log("Sending quote to API...")
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: parseInt(selectedCustomer),
          title: quoteTitle,
          description: quoteDescription,
          validUntil: validUntil || null,
          notes,
          terms,
          taxRate,
          discountAmount,
          items: lineItems.map(item => ({
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        }),
      })

      console.log("Response status:", res.status)

      if (!res.ok) {
        const error = await res.json()
        console.error("API error:", error)
        throw new Error(error.error || "Failed to create quote")
      }

      const newQuote = await res.json()
      console.log("Quote created:", newQuote)
      
      if (sendImmediately) {
        // Send the quote immediately
        console.log("Sending quote email...")
        const sendRes = await fetch(`/api/quotes/${newQuote.id}/send`, { method: "POST" })
        console.log("Send response status:", sendRes.status)
        if (sendRes.ok) {
          toast.success("Quote created and sent successfully!")
        } else {
          const sendError = await sendRes.json()
          console.error("Send error:", sendError)
          toast.success("Quote created! Failed to send email.")
        }
      } else {
        toast.success("Quote saved as draft")
      }

      resetForm()
      setCreateDialogOpen(false)
      fetchQuotes()
    } catch (error: any) {
      console.error("Create quote error:", error)
      toast.error(error.message || "Failed to create quote")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendQuote = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: "POST" })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to send quote")
      }
      const data = await res.json()
      
      // Check if there was a warning (email failed but quote was marked as sent)
      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success("Quote sent successfully!")
      }
      fetchQuotes()
    } catch (error: any) {
      toast.error(error.message || "Failed to send quote")
    }
  }

  const handleDuplicateQuote = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to duplicate quote")
      setInfoDialogTitle("Quote duplicated")
      setInfoDialogMessage("A duplicate quote has been created.")
      setInfoDialogOpen(true)
      fetchQuotes()
    } catch (error) {
      toast.error("Failed to duplicate quote")
    }
  }

  const handleFollowUp = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/follow-up`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to send follow-up")
      setInfoDialogTitle("Follow-up sent")
      setInfoDialogMessage("The follow-up email has been sent to the customer.")
      setInfoDialogOpen(true)
    } catch (error) {
      toast.error("Failed to send follow-up")
    }
  }

  const handleConvertToJob = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to convert")
      }
      toast.success("Quote converted to job!")
      fetchQuotes()
    } catch (error: any) {
      toast.error(error.message || "Failed to convert quote")
    }
  }

  const handleDeleteClick = (quoteId: number) => {
    setQuoteToDelete(quoteId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/quotes/${quoteToDelete}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setInfoDialogTitle("Quote deleted")
      setInfoDialogMessage("The quote has been deleted.")
      setInfoDialogOpen(true)
      fetchQuotes()
    } catch (error) {
      toast.error("Failed to delete quote")
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setQuoteToDelete(null)
    }
  }

  const handleViewQuote = (quote: Quote) => {
    setViewingQuote(quote)
    setViewDialogOpen(true)
  }

  const getCustomerLabel = (customer?: Quote["customer"] | Customer | null) => {
    if (!customer) return "Unknown Customer"
    if (customer.name) return customer.name
    const first = (customer as any).firstName
    const last = (customer as any).lastName
    const combined = [first, last].filter(Boolean).join(" ")
    return combined || "Unknown Customer"
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-"
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const pendingQuotes = quotes.filter(q => q.status === "sent" || q.status === "pending")

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeaderClient />
      <main className="flex-1 p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Quotes & Estimates</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Create and send professional quotes to customers</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
              <DialogDescription>Build a professional quote for your customer</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0">
                  <Label>Customer *</Label>
                  <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select a customer" className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {getCustomerLabel(customer)} {customer.email && `(${customer.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 min-w-0">
                  <Label>Valid Until</Label>
                  <Input 
                    type="date" 
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quote Title *</Label>
                <Input 
                  placeholder="e.g., Office Deep Clean, Move-out Cleaning"
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Brief description of the services..."
                  value={quoteDescription}
                  onChange={(e) => setQuoteDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Line Items *</Label>
                  <Button variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Description</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Rate (£)</TableHead>
                        <TableHead className="text-right">Total (£)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              placeholder="Service description"
                              value={item.title}
                              onChange={(e) => updateLineItem(index, "title", e.target.value)}
                              className="border-0 p-0 h-auto focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 0)}
                              className="w-16 text-center border-0 p-0 h-auto focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="w-20 text-right border-0 p-0 h-auto focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">£{item.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeLineItem(index)}
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Totals */}
                  <div className="border-t bg-muted/50 p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>£{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span>Tax</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="w-16 h-7 text-center"
                        />
                        <span>%</span>
                      </div>
                      <span>£{taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span>Discount</span>
                        <span>£</span>
                        <Input
                          type="number"
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="w-20 h-7 text-right"
                        />
                      </div>
                      <span className="text-green-600">-£{discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>£{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea 
                  placeholder="Additional notes for the customer..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Textarea 
                  placeholder="Payment terms, cancellation policy, etc."
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleCreateQuote(false)} disabled={isSaving}>
                Save as Draft
              </Button>
              <Button type="button" onClick={() => handleCreateQuote(true)} disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Quote
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
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileSignature className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{summary?.total || 0}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Total quotes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{pendingQuotes.length}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Pending response</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Pound className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">£{(summary?.acceptedValue || 0).toLocaleString()}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Accepted value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">£{(summary?.pendingValue || 0).toLocaleString()}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">Pending value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="w-full sm:w-auto" onClick={fetchQuotes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Quotes Table */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 sm:hidden">
            {quotes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No quotes found. Create your first quote to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <Card key={quote.id} className="border-muted">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">{quote.quoteNumber}</p>
                        <p className="font-medium text-sm">{getCustomerLabel(quote.customer)}</p>
                        {quote.customer?.email && (
                          <p className="text-xs text-muted-foreground">{quote.customer.email}</p>
                        )}
                        </div>
                        {getStatusBadge(quote.status, quote.isExpired)}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="text-sm text-foreground font-medium">{quote.title}</p>
                        <div className="flex items-center justify-between">
                          <span>Amount</span>
                          <span className="text-foreground font-medium">£{parseFloat(quote.total || "0").toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Created</span>
                          <span>{formatDate(quote.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Valid Until</span>
                          <span className={quote.isExpired ? "text-red-600" : ""}>
                            {quote.validUntil ? formatDate(quote.validUntil) : "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewQuote(quote)}>
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
                            <DropdownMenuItem onClick={() => handleViewQuote(quote)}>
                              <Eye className="h-4 w-4 mr-2" /> View Quote
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleSendQuote(quote.id)}>
                                <Send className="h-4 w-4 mr-2" /> Send to Customer
                              </DropdownMenuItem>
                            )}
                            {(quote.status === "sent" || quote.status === "pending") && (
                              <DropdownMenuItem onClick={() => handleFollowUp(quote.id)}>
                                <Mail className="h-4 w-4 mr-2" /> Send Follow-up
                              </DropdownMenuItem>
                            )}
                            {quote.status === "accepted" && (
                              <DropdownMenuItem onClick={() => handleConvertToJob(quote.id)}>
                                <ArrowUpRight className="h-4 w-4 mr-2" /> Convert to Job
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicateQuote(quote.id)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(quote.id)}
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
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No quotes found. Create your first quote to get started.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono font-medium">{quote.quoteNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{getCustomerLabel(quote.customer)}</p>
                        {quote.customer?.email && (
                          <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{quote.title}</TableCell>
                    <TableCell className="text-right font-medium">
                      £{parseFloat(quote.total || "0").toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(quote.status, quote.isExpired)}</TableCell>
                    <TableCell>{formatDate(quote.createdAt)}</TableCell>
                    <TableCell>
                      {quote.validUntil ? (
                        <span className={quote.isExpired ? "text-red-600" : ""}>
                          {formatDate(quote.validUntil)}
                        </span>
                      ) : "-"}
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
                            <DropdownMenuItem onClick={() => handleViewQuote(quote)}>
                              <Eye className="h-4 w-4 mr-2" /> View Quote
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <DropdownMenuItem onClick={() => handleSendQuote(quote.id)}>
                                <Send className="h-4 w-4 mr-2" /> Send to Customer
                              </DropdownMenuItem>
                            )}
                            {(quote.status === "sent" || quote.status === "pending") && (
                              <DropdownMenuItem onClick={() => handleFollowUp(quote.id)}>
                                <Mail className="h-4 w-4 mr-2" /> Send Follow-up
                              </DropdownMenuItem>
                            )}
                            {quote.status === "accepted" && (
                              <DropdownMenuItem onClick={() => handleConvertToJob(quote.id)}>
                                <ArrowUpRight className="h-4 w-4 mr-2" /> Convert to Job
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicateQuote(quote.id)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(quote.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Quote Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingQuote && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Quote {viewingQuote.quoteNumber}</DialogTitle>
                  {getStatusBadge(viewingQuote.status, viewingQuote.isExpired)}
                </div>
                <DialogDescription>
                  Created {formatDate(viewingQuote.createdAt)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Customer</Label>
                    <p className="font-medium">{getCustomerLabel(viewingQuote.customer)}</p>
                    {viewingQuote.customer?.email && (
                      <p className="text-sm text-muted-foreground">{viewingQuote.customer.email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Label className="text-muted-foreground">Valid Until</Label>
                    <p className={viewingQuote.isExpired ? "text-red-600 font-medium" : "font-medium"}>
                      {viewingQuote.validUntil ? formatDate(viewingQuote.validUntil) : "No expiry"}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">{viewingQuote.title}</h3>
                  {viewingQuote.description && (
                    <p className="text-muted-foreground">{viewingQuote.description}</p>
                  )}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingQuote.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.title}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right">£{parseFloat(String(item.unitPrice || 0)).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">£{parseFloat(String(item.amount || 0)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="bg-muted/50 p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>£{parseFloat(viewingQuote.subtotal || "0").toFixed(2)}</span>
                    </div>
                    {viewingQuote.taxAmount && parseFloat(viewingQuote.taxAmount) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax ({viewingQuote.taxRate}%)</span>
                        <span>£{parseFloat(viewingQuote.taxAmount).toFixed(2)}</span>
                      </div>
                    )}
                    {viewingQuote.discountAmount && parseFloat(viewingQuote.discountAmount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-£{parseFloat(viewingQuote.discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>£{parseFloat(viewingQuote.total || "0").toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                {viewingQuote.status === "draft" && (
                  <Button onClick={() => {
                    handleSendQuote(viewingQuote.id)
                    setViewDialogOpen(false)
                  }}>
                    <Send className="h-4 w-4 mr-2" /> Send Quote
                  </Button>
                )}
                {viewingQuote.status === "accepted" && (
                  <Button onClick={() => {
                    handleConvertToJob(viewingQuote.id)
                    setViewDialogOpen(false)
                  }}>
                    <ArrowUpRight className="h-4 w-4 mr-2" /> Convert to Job
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{infoDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{infoDialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInfoDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </main>
    </div>
  )
}
