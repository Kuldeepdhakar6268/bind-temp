"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

interface Payment {
  id: number
  amount: string
  method: string
  status: string
  reference?: string | null
  notes?: string | null
  paidAt: Date | string
}

interface PaymentHistoryProps {
  payments: Payment[]
}

const formatDate = (value: Date | string) => {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-GB", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)
}

const getMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  }
  return labels[method] || method
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
    completed: { variant: "default", label: "Completed" },
    pending: { variant: "secondary", label: "Pending" },
    failed: { variant: "destructive", label: "Failed" },
    refunded: { variant: "outline", label: "Refunded" },
  }
  const config = variants[status] || { variant: "outline" as const, label: status }
  return <Badge variant={config.variant}>{config.label}</Badge>
}

export function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No payments recorded yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">
                  {formatDate(payment.paidAt)}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(parseFloat(payment.amount))}
                </TableCell>
                <TableCell>{getMethodLabel(payment.method)}</TableCell>
                <TableCell>
                  {payment.reference ? (
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {payment.reference}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {payment.notes || <span className="text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total Paid:</span>
            <span className="text-lg font-bold">
              {formatCurrency(
                payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

