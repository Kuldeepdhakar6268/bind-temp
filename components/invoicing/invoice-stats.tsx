"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, Clock, CheckCircle2, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { InvoiceItem } from "@/lib/db/queries"

interface InvoiceStatsProps {
  invoices: InvoiceItem[]
}

export function InvoiceStats({ invoices }: InvoiceStatsProps) {
  const stats = useMemo(() => {
    // Calculate stats from real invoice data
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const pending = invoices
      .filter((inv) => inv.status === "pending" || inv.status === "sent")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const paid = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const overdue = invoices
      .filter((inv) => inv.status === "overdue")
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)

    return [
      { title: "Total Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "bg-chart-2/10 text-chart-2" },
      { title: "Pending", value: formatCurrency(pending), icon: Clock, color: "bg-chart-3/10 text-chart-3" },
      { title: "Paid", value: formatCurrency(paid), icon: CheckCircle2, color: "bg-chart-2/10 text-chart-2" },
      { title: "Overdue", value: formatCurrency(overdue), icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
    ]
  }, [invoices])

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
