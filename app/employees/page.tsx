"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { EmployeesList } from "@/components/employees/employees-list"
import { Button } from "@/components/ui/button"
import { Plus, Upload, Download } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

export default function EmployeesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [companyMaxEmployees, setCompanyMaxEmployees] = useState<number | null>(null)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [limitDialogOpen, setLimitDialogOpen] = useState(false)

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await fetch("/api/employees")
      if (!res.ok) {
        throw new Error("Failed to export employees")
      }
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) {
        toast.error("No employees to export")
        return
      }

      const headers = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "role",
        "employmentType",
        "status",
        "startDate",
      ]
      const rows = data.map((employee: any) =>
        headers
          .map((header) => {
            const value = employee[header] ?? ""
            const escaped = String(value).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(",")
      )

      const csv = [headers.join(","), ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success("Export started")
    } catch (error) {
      console.error(error)
      toast.error("Failed to export employees")
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let active = true

    const fetchCompanyProfile = async () => {
      try {
        const response = await fetch("/api/company/profile")
        if (!response.ok) return
        const data = await response.json()
        if (!active) return
        const maxEmp =
          typeof data.maxEmployees === "number"
            ? data.maxEmployees
            : typeof data.max_employees === "number"
            ? data.max_employees
            : null
        setCompanyMaxEmployees(maxEmp)
      } catch (error) {
        console.error("Failed to fetch company profile:", error)
      }
    }

    fetchCompanyProfile()
    return () => {
      active = false
    }
  }, [])

  const handleRequestAddEmployee = () => {
    const limit = companyMaxEmployees ?? Infinity
    if (employeeCount >= limit) {
      setLimitDialogOpen(true)
      return
    }
    setShowAddDialog(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground mt-1">Manage your cleaning staff</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
            <Button size="sm" onClick={handleRequestAddEmployee}>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        <EmployeesList
          key={refreshKey}
          onRefresh={handleRefresh}
          onCountChange={setEmployeeCount}
        />

        <AddEmployeeDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={handleRefresh} />

        <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Employee Limit Reached</DialogTitle>
              <DialogDescription>
                Your company is currently limited to {companyMaxEmployees ?? "the configured"} employees. Please contact the CleanManager admin team to increase your allowance.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-end space-x-2">
              <Button variant="ghost" onClick={() => setLimitDialogOpen(false)}>
                Close
              </Button>
              <Button asChild variant="outline">
                <a href="mailto:support@cleanmanager.io">Contact CleanManager</a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
