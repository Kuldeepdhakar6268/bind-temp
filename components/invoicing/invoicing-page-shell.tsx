"use client"

import { useMemo, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { InvoicesList } from "@/components/invoicing/invoices-list"
import { InvoiceStats } from "@/components/invoicing/invoice-stats"
import { Button } from "@/components/ui/button"
import { Plus, Download, Filter } from "lucide-react"
import { CreateInvoiceDialog } from "@/components/invoicing/create-invoice-dialog"
import type { InvoiceItem } from "@/lib/db/queries"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type InvoicingPageShellProps = {
  invoices: InvoiceItem[]
}

export function InvoicingPageShell({ invoices }: InvoicingPageShellProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [exporting, setExporting] = useState(false)

  const handleInvoiceCreated = () => {
    // Refresh the page to show the new invoice
    window.location.reload()
  }

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const statusMatch = statusFilter === "all" || invoice.status === statusFilter
      if (!statusMatch) return false
      if (!term) return true
      const haystack = [
        invoice.invoiceNumber,
        invoice.customerName,
        invoice.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [invoices, searchTerm, statusFilter])

  const handleExport = async () => {
    if (exporting) return
    if (filteredInvoices.length === 0) {
      toast.error("No invoices to export")
      return
    }
    setExporting(true)
    try {
      const csvEscape = (value: string | number | null | undefined) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`
      const rows = [
        ["Invoice Number", "Customer", "Status", "Issued At", "Due At", "Amount"],
        ...filteredInvoices.map((invoice) => [
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.status,
          invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "N/A",
          invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : "N/A",
          invoice.amount ?? 0,
        ]),
      ]
      const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      const dateStamp = new Date().toISOString().split("T")[0]
      link.href = url
      link.download = `invoices-${dateStamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Export started")
    } catch (error) {
      console.error("Invoice export error:", error)
      toast.error("Failed to export invoices")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoicing</h1>
            <p className="text-muted-foreground mt-1">Manage invoices and billing</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setFilterOpen(true)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          </div>
        </div>

        <InvoiceStats invoices={filteredInvoices} />

        <InvoicesList invoices={filteredInvoices} />

        <CreateInvoiceDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={handleInvoiceCreated}
        />

        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Filter invoices</DialogTitle>
              <DialogDescription>Refine the list by status or search.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-search">Search</Label>
                <Input
                  id="invoice-search"
                  placeholder="Invoice number or customer name"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                  }}
                >
                  Clear filters
                </Button>
                <Button onClick={() => setFilterOpen(false)}>Done</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
