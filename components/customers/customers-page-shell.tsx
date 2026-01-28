"use client"

import { useState, useRef } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { CustomersList } from "@/components/customers/customers-list"
import { Button } from "@/components/ui/button"
import { Plus, Upload, Download } from "lucide-react"
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog"

export function CustomersPageShell() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const customersListRef = useRef<{ refresh: () => void }>(null)

  const parseCsvLine = (line: string) => {
    const values: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"' && nextChar === '"') {
        current += '"'
        i += 1
        continue
      }
      if (char === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (char === "," && !inQuotes) {
        values.push(current.trim())
        current = ""
        continue
      }
      current += char
    }

    values.push(current.trim())
    return values.map((value) => value.replace(/^"|"$/g, ""))
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const res = await fetch("/api/customers")
      if (!res.ok) {
        throw new Error("Failed to export customers")
      }
      const data = await res.json()
      const headers = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "customerType",
        "status",
        "companyName",
        "address",
        "city",
        "postcode",
        "country",
      ]

      const rows = data.map((customer: any) =>
        headers
          .map((header) => {
            const value = customer[header] ?? ""
            const escaped = String(value).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(","),
      )

      const csv = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      window.alert("Failed to export customers.")
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
      if (lines.length < 2) {
        window.alert("CSV file is empty.")
        return
      }

      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase())
      const requiredHeaders = ["firstname", "lastname", "email"]
      const missing = requiredHeaders.filter((header) => !headers.includes(header))
      if (missing.length > 0) {
        window.alert(`Missing required columns: ${missing.join(", ")}`)
        return
      }

      for (let i = 1; i < lines.length; i += 1) {
        const values = parseCsvLine(lines[i])
        const record: Record<string, string> = {}
        headers.forEach((header, index) => {
          record[header] = values[index] ?? ""
        })

        const payload = {
          firstName: record.firstname,
          lastName: record.lastname,
          email: record.email,
          phone: record.phone || undefined,
          customerType: record.customertype || undefined,
          status: record.status || undefined,
          companyName: record.companyname || undefined,
          address: record.address || undefined,
          city: record.city || undefined,
          postcode: record.postcode || undefined,
          country: record.country || undefined,
        }

        if (!payload.firstName || !payload.lastName || !payload.email) {
          continue
        }

        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}))
          console.error("Import failed:", errorBody)
        }
      }

      window.alert("Import completed.")
      window.location.reload()
    } catch (error) {
      console.error(error)
      window.alert("Failed to import customers.")
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleCustomerAdded = () => {
    // Trigger refresh of the customers list
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground mt-1">Manage your client database</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  handleImportFile(file)
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "Importing..." : "Import"}
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
            <Button size="sm" onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        <CustomersList />

        <AddCustomerDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={handleCustomerAdded} />
      </main>
    </div>
  )
}
