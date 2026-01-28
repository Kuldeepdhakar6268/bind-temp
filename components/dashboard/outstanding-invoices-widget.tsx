"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, AlertCircle, Clock } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

type OutstandingInvoice = {
  id: number
  invoiceNumber: string
  customer: {
    name: string
  }
  totalAmount: string
  paidAmount: string
  status: string
  dueDate: Date | null
}

export function OutstandingInvoicesWidget() {
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOutstandingInvoices()
  }, [])

  const fetchOutstandingInvoices = async () => {
    try {
      const response = await fetch("/api/invoices?status=sent,overdue&limit=5")
      if (response.ok) {
        const data = await response.json()
        setInvoices(data)
      }
    } catch (error) {
      console.error("Error fetching outstanding invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysOverdue = (dueDate: Date | null) => {
    if (!dueDate) return 0
    const today = new Date()
    const due = new Date(dueDate)
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outstanding Invoices</CardTitle>
          <CardDescription>Invoices awaiting payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Outstanding Invoices</CardTitle>
          <CardDescription>Invoices awaiting payment</CardDescription>
        </div>
        <Link href="/payments">
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No outstanding invoices</p>
            <p className="text-xs mt-1">All invoices are paid!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const daysOverdue = getDaysOverdue(invoice.dueDate)
              const outstandingAmount = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)
              const isOverdue = invoice.status === "overdue" || daysOverdue > 0

              return (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOverdue ? "bg-destructive/10" : "bg-amber-500/10"}`}>
                      {isOverdue ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{invoice.customer.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {invoice.invoiceNumber}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {invoice.dueDate && (
                          <>
                            Due {new Date(invoice.dueDate).toLocaleDateString()}
                            {daysOverdue > 0 && (
                              <span className="text-destructive ml-1">
                                ({daysOverdue} days overdue)
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      £{outstandingAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

