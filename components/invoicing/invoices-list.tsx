"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Download, Send } from "lucide-react"
import { formatCurrency, getStatusTheme } from "@/lib/utils"
import { downloadInvoicePDF } from "@/lib/pdf-generator"
import type { InvoiceItem } from "@/lib/db/queries"
import { useState } from "react"
import { toast } from "sonner"

type InvoicesListProps = {
  invoices?: InvoiceItem[]
}

const formatDate = (value?: Date | string | null) => {
  if (!value) return "N/A"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "N/A"
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

export function InvoicesList({ invoices = [] }: InvoicesListProps) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [sendingReminderId, setSendingReminderId] = useState<number | null>(null)
  const [reminderSentId, setReminderSentId] = useState<number | null>(null)

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      setDownloadingId(invoiceId)

      // Fetch invoice data for PDF
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
      if (!response.ok) {
        throw new Error("Failed to fetch invoice data")
      }

      const invoiceData = await response.json()

      // Generate and download PDF
      downloadInvoicePDF(invoiceData)
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast.error("Failed to download PDF. Please try again.")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleSendReminder = async (invoiceId: number) => {
    try {
      setSendingReminderId(invoiceId)
      setReminderSentId(null)

      const response = await fetch(`/api/invoices/${invoiceId}/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to send reminder")
      }

      toast.success(`Reminder sent to ${data.customerEmail}`)
      setReminderSentId(invoiceId)
    } catch (error) {
      console.error("Error sending reminder:", error)
      toast.error("Failed to send reminder. Please try again.")
    } finally {
      setSendingReminderId(null)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {invoices.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No invoices yet
            </div>
          ) : (
            invoices.map((invoice) => {
              const amount = typeof invoice.amount === "number" ? invoice.amount : Number(invoice.amount ?? 0)
              const statusTheme = getStatusTheme(invoice.status ?? "pending")
              return (
                <div key={invoice.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{invoice.invoiceNumber}</div>
                      <div className="text-sm text-muted-foreground">{invoice.customerName}</div>
                    </div>
                    <Badge className={statusTheme.badgeClass}>{statusTheme.label}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    <div>Issued: {formatDate(invoice.issuedAt)}</div>
                    <div>Due: {formatDate(invoice.dueAt)}</div>
                    <div className="font-medium text-foreground">Amount: {formatCurrency(amount)}</div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" title="View Invoice">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      title="Download PDF"
                      onClick={() => handleDownloadPDF(invoice.id)}
                      disabled={downloadingId === invoice.id}
                    >
                      <Download className={`h-4 w-4 mr-1 ${downloadingId === invoice.id ? "animate-pulse" : ""}`} />
                      PDF
                    </Button>
                    {invoice.status !== "paid" && (
                      <div className="flex flex-1 flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          title="Send Payment Reminder"
                          onClick={() => handleSendReminder(invoice.id)}
                          disabled={sendingReminderId === invoice.id}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {sendingReminderId === invoice.id ? "Sending..." : "Send"}
                        </Button>
                        {reminderSentId === invoice.id && (
                          <p className="text-xs text-emerald-600">Reminder email sent</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No invoices yet
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => {
                  const amount = typeof invoice.amount === "number" ? invoice.amount : Number(invoice.amount ?? 0)
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell>{formatDate(invoice.issuedAt)}</TableCell>
                      <TableCell>{formatDate(invoice.dueAt)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(amount)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusTheme(invoice.status ?? "pending").badgeClass}>
                          {getStatusTheme(invoice.status ?? "pending").label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" title="View Invoice">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            onClick={() => handleDownloadPDF(invoice.id)}
                            disabled={downloadingId === invoice.id}
                          >
                            <Download className={`h-4 w-4 ${downloadingId === invoice.id ? 'animate-pulse' : ''}`} />
                          </Button>
                          {invoice.status !== "paid" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Send Payment Reminder"
                              onClick={() => handleSendReminder(invoice.id)}
                              disabled={sendingReminderId === invoice.id}
                            >
                              <Send
                                className={`h-4 w-4 ${sendingReminderId === invoice.id ? "animate-pulse" : ""}`}
                              />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
