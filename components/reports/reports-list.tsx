"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Eye, Loader2, BarChart3, Users, DollarSign, CalendarDays } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths } from "date-fns"

interface ReportType {
  id: string
  name: string
  description: string
  type: string
  icon: React.ReactNode
  endpoint: string
}

const reportTypes: ReportType[] = [
  {
    id: "financial",
    name: "Financial Overview",
    description: "Revenue, expenses, and profit analysis",
    type: "Finance",
    icon: <DollarSign className="h-6 w-6 text-chart-2" />,
    endpoint: "/api/reports/financial",
  },
  {
    id: "jobs",
    name: "Jobs Summary",
    description: "Job completions and performance metrics",
    type: "Operations",
    icon: <CalendarDays className="h-6 w-6 text-chart-1" />,
    endpoint: "/api/jobs",
  },
  {
    id: "employees",
    name: "Employee Performance",
    description: "Work hours and productivity analysis",
    type: "HR",
    icon: <Users className="h-6 w-6 text-chart-4" />,
    endpoint: "/api/wages",
  },
  {
    id: "profitability",
    name: "Profitability Report",
    description: "Customer and service profitability",
    type: "Finance",
    icon: <BarChart3 className="h-6 w-6 text-chart-3" />,
    endpoint: "/api/profitability",
  },
]

export function ReportsList() {
  const [generating, setGenerating] = useState<string | null>(null)
  const [reportData, setReportData] = useState<Record<string, any>>({})

  async function generateReport(report: ReportType) {
    setGenerating(report.id)
    try {
      const startDate = startOfMonth(subMonths(new Date(), 1)).toISOString()
      const endDate = endOfMonth(subMonths(new Date(), 1)).toISOString()
      
      const response = await fetch(
        `${report.endpoint}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      )
      
      if (!response.ok) throw new Error("Failed to generate report")
      
      const data = await response.json()
      setReportData(prev => ({ ...prev, [report.id]: data }))
    } catch (err) {
      console.error("Error generating report:", err)
    } finally {
      setGenerating(null)
    }
  }

  function downloadReport(report: ReportType) {
    const data = reportData[report.id]
    if (!data) return
    
    // Convert to JSON and download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${report.id}-report-${format(new Date(), "yyyy-MM-dd")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reportTypes.map((report) => {
            const hasData = !!reportData[report.id]
            const isGenerating = generating === report.id

            return (
              <div
                key={report.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    {report.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{report.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {report.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{report.description}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasData && (
                    <Badge className="bg-chart-2">Ready</Badge>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => generateReport(report)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                  {hasData && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadReport(report)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
