"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { Receipt } from "lucide-react"

interface Expense {
  id: number
  category: string
  description: string
  amount: string
  paymentMethod?: string | null
  vendor?: string | null
  receiptNumber?: string | null
  taxDeductible: boolean
  expenseDate: Date | string
}

interface ExpensesListProps {
  expenses: Expense[]
}

const formatDate = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-GB", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric"
  }).format(date)
}

const getCategoryBadge = (category: string) => {
  const colors: Record<string, string> = {
    supplies: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    fuel: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    equipment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    labor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    vehicle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    marketing: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
    utilities: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
    insurance: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  }
  
  return (
    <Badge variant="outline" className={colors[category] || colors.other}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Badge>
  )
}

export function ExpensesList({ expenses }: ExpensesListProps) {
  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No expenses recorded yet
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0)
  const taxDeductibleTotal = expenses
    .filter(exp => exp.taxDeductible)
    .reduce((sum, exp) => sum + parseFloat(exp.amount), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Tax Deductible</p>
            <p className="text-2xl font-bold">{formatCurrency(taxDeductibleTotal)}</p>
          </div>
        </div>

        <div className="space-y-3 sm:hidden">
          {expenses.map((expense) => (
            <div key={expense.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(parseFloat(expense.amount))}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {getCategoryBadge(expense.category)}
                {expense.taxDeductible && (
                  <Badge variant="outline" className="text-xs">
                    Tax Deductible
                  </Badge>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Vendor:</span>{" "}
                {expense.vendor || "None"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Receipt:</span>{" "}
                {expense.receiptNumber ? (
                  <span className="inline-flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    <span>{expense.receiptNumber}</span>
                  </span>
                ) : (
                  "None"
                )}
              </div>
            </div>
          ))}
        </div>

        <Table className="hidden sm:table">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium">
                  {formatDate(expense.expenseDate)}
                </TableCell>
                <TableCell>{getCategoryBadge(expense.category)}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{expense.description}</p>
                    {expense.taxDeductible && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Tax Deductible
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {expense.vendor || <span className="text-muted-foreground">None</span>}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(parseFloat(expense.amount))}
                </TableCell>
                <TableCell>
                  {expense.receiptNumber ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Receipt className="h-3 w-3" />
                      <code className="bg-muted px-1 py-0.5 rounded">
                        {expense.receiptNumber}
                      </code>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

