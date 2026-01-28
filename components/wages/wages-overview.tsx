"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Clock, TrendingUp, Loader2, Users } from "lucide-react"
import { startOfMonth, endOfMonth, format } from "date-fns"

interface WageData {
  employee: {
    id: number
    firstName: string
    lastName: string
    hourlyRate: string | null
  }
  totalHours: number
  totalMinutes: number
  totalWages: number
  sessionsCount: number
}

interface WagesResponse {
  employees: WageData[]
  summary: {
    totalEmployees: number
    totalHours: number
    totalWages: number
  }
}

// Simplified UK tax estimate (20% basic rate after personal allowance)
function estimateTax(grossPay: number): number {
  // Simplified - assume 20% tax rate
  return grossPay * 0.2
}

export function WagesOverview() {
  const [data, setData] = useState<WagesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchWages() {
      try {
        // Get current month's date range
        const now = new Date()
        const startDate = startOfMonth(now).toISOString()
        const endDate = endOfMonth(now).toISOString()
        
        const response = await fetch(
          `/api/wages?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
        )
        if (!response.ok) throw new Error("Failed to fetch wages")
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error("Error fetching wages:", err)
        setError("Failed to load payroll data")
      } finally {
        setLoading(false)
      }
    }

    fetchWages()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {error}
      </div>
    )
  }

  const summary = data?.summary || { totalEmployees: 0, totalHours: 0, totalWages: 0 }
  const avgPerEmployee = summary.totalEmployees > 0 
    ? (summary.totalWages / summary.totalEmployees).toFixed(0) 
    : "0"

  const stats = [
    { title: "Total Payroll", value: `£${summary.totalWages.toFixed(2)}`, icon: DollarSign, color: "text-chart-2" },
    { title: "Hours Logged", value: summary.totalHours.toFixed(1), icon: Clock, color: "text-chart-1" },
    { title: "Avg per Employee", value: `£${avgPerEmployee}`, icon: TrendingUp, color: "text-chart-3" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Details - {format(new Date(), "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.employees || data.employees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No wage data for this period</p>
              <p className="text-sm text-muted-foreground mt-1">
                Wages are calculated from logged work sessions
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Est. Tax</TableHead>
                    <TableHead className="text-right">Est. Net</TableHead>
                    <TableHead>Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((wage) => {
                    const initials = `${wage.employee.firstName[0]}${wage.employee.lastName[0]}`
                    const rate = wage.employee.hourlyRate ? parseFloat(wage.employee.hourlyRate) : 0
                    const gross = wage.totalWages
                    const tax = estimateTax(gross)
                    const net = gross - tax

                    return (
                      <TableRow key={wage.employee.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{wage.employee.firstName} {wage.employee.lastName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{wage.totalHours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right">£{rate.toFixed(2)}/h</TableCell>
                        <TableCell className="text-right font-medium">£{gross.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">£{tax.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold">£{net.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {wage.sessionsCount} session{wage.sessionsCount !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
