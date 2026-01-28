"use client"

import { useEffect, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Download, Send, Clock, CheckCircle, AlertCircle, TrendingUp, Banknote } from "lucide-react"
import { PaymentsList } from "@/components/payments/payments-list"
import { BulkReminderDialog } from "@/components/payments/bulk-reminder-dialog"
import { toast } from "sonner"

type Invoice = {
  id: number
  invoiceNumber: string
  customerId: number
  customer?: {
    name: string
    email: string
  }
  totalAmount: string
  paidAmount: string
  status: string
  dueDate: Date | null
  createdAt: Date
}

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices")
      if (response.ok) {
        const data = await response.json()
        setInvoices(data)
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReminderSend = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send-reminder`, {
        method: "POST",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send reminder")
      }
      const customerName = data?.customerName || "customer"
      toast.success(`Reminder sent to ${customerName}`)
    } catch (error) {
      console.error("Error sending reminder:", error)
      toast.error(error instanceof Error ? error.message : "Failed to send reminder")
    }
  }

  const handleBulkReminders = async (message: string, includeLink: boolean) => {
    try {
      const overdueInvoices = invoices.filter((inv) => inv.status === "overdue" || inv.status === "sent")
      // TODO: Implement bulk reminder API
      console.log("Sending bulk reminders:", { count: overdueInvoices.length, message, includeLink })
      toast.success(`Bulk reminders sent to ${overdueInvoices.length} customers! (Demo)`)
    } catch (error) {
      console.error("Error sending bulk reminders:", error)
      toast.error("Failed to send bulk reminders")
    }
  }

  const handleExportReport = () => {
    if (invoices.length === 0) {
      toast.error("No invoices to export")
      return
    }

    const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const rows = [
      [
        "Invoice Number",
        "Customer",
        "Email",
        "Status",
        "Total Amount",
        "Paid Amount",
        "Outstanding Amount",
        "Due Date",
        "Created At",
      ],
      ...invoices.map((invoice) => {
        const outstandingAmount = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)
        return [
          invoice.invoiceNumber,
          invoice.customer?.name ?? "Unknown Customer",
          invoice.customer?.email ?? "No email",
          invoice.status,
          invoice.totalAmount,
          invoice.paidAmount,
          outstandingAmount.toFixed(2),
          invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A",
          invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : "N/A",
        ]
      }),
    ]

    const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    const dateStamp = new Date().toISOString().split("T")[0]
    link.href = url
    link.download = `payments-report-${dateStamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    toast.success("Export started")
  }

  // Calculate stats
  const totalOverdue = invoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount)), 0)

  const totalPending = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "pending")
    .reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) - parseFloat(inv.paidAmount)), 0)

  const totalCollected = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0)

  const collectionRate =
    totalCollected + totalOverdue + totalPending > 0
      ? (totalCollected / (totalCollected + totalOverdue + totalPending)) * 100
      : 0

  const overdueCount = invoices.filter((inv) => inv.status === "overdue").length
  const pendingCount = invoices.filter((inv) => inv.status === "sent" || inv.status === "pending").length
  const paidCount = invoices.filter((inv) => inv.status === "paid").length

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Payment Management</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track invoices, reminders, and payments</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleExportReport}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
            <Button onClick={() => setBulkReminderOpen(true)} disabled={overdueCount + pendingCount === 0} className="w-full sm:w-auto">
              <Send className="mr-2 h-4 w-4" />
              Send Bulk Reminders
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Overdue Payments</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-destructive">GBP {totalOverdue.toFixed(2)}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">{overdueCount} invoices overdue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending Payments</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">GBP {totalPending.toFixed(2)}</div>
              <p className="text-[11px] sm:text-xs text-muted-foreground">{pendingCount} awaiting payment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Collected This Month</CardTitle>
              <Banknote className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-emerald-600">GBP {totalCollected.toFixed(2)}</div>
              <div className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span>{paidCount} invoices paid</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Collection Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{collectionRate.toFixed(1)}%</div>
              <Progress value={collectionRate} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="outstanding">
          <TabsList className="w-full grid grid-cols-2 md:w-fit md:inline-flex">
            <TabsTrigger value="outstanding">Outstanding Invoices</TabsTrigger>
            <TabsTrigger value="all">All Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="outstanding" className="mt-4">
            <PaymentsList
              invoices={invoices.filter((inv) => inv.status !== "paid")}
              onReminderSend={handleReminderSend}
              onPaymentRecorded={fetchInvoices}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <PaymentsList
              invoices={invoices}
              onReminderSend={handleReminderSend}
              onPaymentRecorded={fetchInvoices}
            />
          </TabsContent>
        </Tabs>

        {/* Bulk Reminder Dialog */}
        <BulkReminderDialog
          open={bulkReminderOpen}
          onOpenChange={setBulkReminderOpen}
          invoiceCount={overdueCount + pendingCount}
          totalAmount={totalOverdue + totalPending}
          onSend={handleBulkReminders}
        />
      </main>
    </div>
  )
}

