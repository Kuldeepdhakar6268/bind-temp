"use client"

import { useEffect, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Button } from "@/components/ui/button"
import { Plus, Download } from "lucide-react"
import { ExpensesList } from "@/components/expenses/expenses-list"
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog"

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      const response = await fetch("/api/expenses")
      if (response.ok) {
        const data = await response.json()
        setExpenses(data)
      }
    } catch (error) {
      console.error("Error fetching expenses:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    fetchExpenses()
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Expense Tracking</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track and manage business expenses</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading expenses...</p>
          </div>
        ) : (
          <ExpensesList expenses={expenses} />
        )}

        <AddExpenseDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleSuccess}
        />
      </main>
    </div>
  )
}

