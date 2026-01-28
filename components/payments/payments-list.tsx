"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, Filter, MoreHorizontal, Send, Clock, CheckCircle, AlertCircle, Mail, Calendar, Download } from "lucide-react"
import { RecordPaymentDialog } from "./record-payment-dialog"

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

type PaymentsListProps = {
  invoices: Invoice[]
  onReminderSend?: (invoiceId: number) => void
  onPaymentRecorded?: () => void
}

export function PaymentsList({ invoices, onReminderSend, onPaymentRecorded }: PaymentsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDaysOverdue = (dueDate: Date | null) => {
    if (!dueDate) return 0
    const today = new Date()
    const due = new Date(dueDate)
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-500"
      case "overdue":
        return "bg-destructive/10 text-destructive"
      case "pending":
      case "sent":
        return "bg-amber-500/10 text-amber-500"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return <CheckCircle className="h-5 w-5" />
      case "overdue":
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Clock className="h-5 w-5" />
    }
  }

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setPaymentDialogOpen(true)
  }

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `invoice-${invoiceId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Error downloading PDF:", error)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Invoice Tracking</CardTitle>
              <CardDescription>Monitor and follow up on outstanding payments</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" className="w-full sm:w-auto">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No invoices found</p>
            ) : (
              filteredInvoices.map((invoice) => {
                const daysOverdue = getDaysOverdue(invoice.dueDate)
                const outstandingAmount = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)

                return (
                  <div
                    key={invoice.id}
                    className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{invoice.customer?.name || "Unknown Customer"}</p>
                            <Badge variant="outline" className="text-xs">
                              {invoice.invoiceNumber}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{invoice.customer?.email || "No email"}</span>
                            {invoice.dueDate && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <Calendar className="h-3 w-3" />
                                <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
                              </>
                            )}
                            {daysOverdue > 0 && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-destructive">{daysOverdue} days overdue</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                          <p className="text-lg font-semibold">GBP {outstandingAmount.toFixed(2)}</p>
                          <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {invoice.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReminderSend?.(invoice.id)}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Remind
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDownloadPDF(invoice.id)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
                              {invoice.status !== "paid" && (
                                <>
                                  <DropdownMenuItem onClick={() => onReminderSend?.(invoice.id)}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Send Reminder
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleMarkAsPaid(invoice)}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Record Payment
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <RecordPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoice={{
            id: selectedInvoice.id,
            invoiceNumber: selectedInvoice.invoiceNumber,
            totalAmount: parseFloat(selectedInvoice.totalAmount),
            paidAmount: parseFloat(selectedInvoice.paidAmount),
            customer: selectedInvoice.customer,
          }}
          onSuccess={() => {
            setPaymentDialogOpen(false)
            onPaymentRecorded?.()
          }}
        />
      )}
    </>
  )
}

