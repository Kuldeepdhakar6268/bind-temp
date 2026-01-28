"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { TrendingUp, TrendingDown, DollarSign, Receipt, CreditCard, AlertCircle } from "lucide-react"

interface FinancialData {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  outstandingInvoices: number
  paidInvoices: number
  overdueInvoices: number
  revenueByMonth: Array<{ month: string; amount: number }>
  expensesByCategory: Array<{ category: string; amount: number }>
}

interface FinancialOverviewProps {
  data?: FinancialData
}

const defaultData: FinancialData = {
  totalRevenue: 0,
  totalExpenses: 0,
  netProfit: 0,
  outstandingInvoices: 0,
  paidInvoices: 0,
  overdueInvoices: 0,
  revenueByMonth: [],
  expensesByCategory: [],
}

export function FinancialOverview({ data = defaultData }: FinancialOverviewProps) {
  const profitMargin = data.totalRevenue > 0
    ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
    : "0.0"

  const isProfitable = data.netProfit >= 0

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {data.paidInvoices} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {isProfitable ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {profitMargin}% profit margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.outstandingInvoices)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.overdueInvoices > 0 && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {data.overdueInvoices} overdue
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.expensesByCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No expenses recorded
            </p>
          ) : (
            <div className="space-y-3">
              {data.expensesByCategory.map((item) => {
                const percentage = data.totalExpenses > 0
                  ? ((item.amount / data.totalExpenses) * 100).toFixed(1)
                  : "0"
                
                return (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{item.category}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.amount)} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Month</CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenueByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No revenue data available
            </p>
          ) : (
            <div className="space-y-3">
              {data.revenueByMonth.map((item) => {
                const maxRevenue = Math.max(...data.revenueByMonth.map(r => r.amount))
                const percentage = maxRevenue > 0
                  ? ((item.amount / maxRevenue) * 100).toFixed(1)
                  : "0"
                
                return (
                  <div key={item.month} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.month}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

