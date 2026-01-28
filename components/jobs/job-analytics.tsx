"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, BarChart3, TrendingUp, Users, Calendar, DollarSign, Star, CheckCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface AnalyticsData {
  summary: {
    totalJobs: number
    completedJobs: number
    scheduledJobs: number
    inProgressJobs: number
    cancelledJobs: number
    completionRate: number
    cancellationRate: number
    avgJobValue: number
    avgQualityRating: number | null
    avgEstimatedDuration: number
  }
  revenue: {
    totalEstimated: number
    totalActual: number
    currency: string
  }
  distribution: {
    byStatus: Record<string, number>
    byDayOfWeek: {
      labels: string[]
      data: number[]
    }
  }
  rankings: {
    topEmployees: { id: number; name: string; completed: number; revenue: number }[]
    topCustomers: { id: number; name: string; jobs: number; revenue: number }[]
  }
  trends: {
    daily: { date: string; jobs: number; completed: number; revenue: number }[]
  }
}

interface JobAnalyticsProps {
  compact?: boolean
}

export function JobAnalytics({ compact = false }: JobAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dateRange, setDateRange] = useState("30")

  const fetchAnalytics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(dateRange))

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      })

      const response = await fetch(`/api/jobs/analytics?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch analytics")
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAnalytics(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  const handleRefresh = async () => {
    toast.info("Refreshing analytics...")
    await fetchAnalytics()
    toast.success("Analytics updated")
  }

  const currencySymbol = data?.revenue.currency === "GBP" ? "£" : 
                         data?.revenue.currency === "EUR" ? "€" : "$"

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-500">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  if (compact) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{data.summary.totalJobs}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{data.summary.completedJobs}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">{currencySymbol}{data.revenue.totalActual.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{data.summary.completionRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Job Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh analytics"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-600">Total Jobs</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{data.summary.totalJobs}</p>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-900">{data.summary.completedJobs}</p>
            <p className="text-sm text-green-600">{data.summary.completionRate}% rate</p>
          </div>

          <div className="p-4 bg-emerald-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-600">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900">
              {currencySymbol}{data.revenue.totalActual.toFixed(2)}
            </p>
            <p className="text-sm text-emerald-600">
              Est: {currencySymbol}{data.revenue.totalEstimated.toFixed(2)}
            </p>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-600">Avg Rating</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900">
              {data.summary.avgQualityRating?.toFixed(1) || "-"}
            </p>
            <p className="text-sm text-yellow-600">out of 5</p>
          </div>
        </div>

        {/* Status Distribution */}
        <div>
          <h3 className="font-medium mb-3">Jobs by Status</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(data.distribution.byStatus).map(([status, count]) => (
              <div
                key={status}
                className={`px-4 py-2 rounded-lg ${
                  status === "completed"
                    ? "bg-green-100 text-green-800"
                    : status === "scheduled"
                    ? "bg-blue-100 text-blue-800"
                    : status === "in-progress"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                <span className="font-medium capitalize">{status.replace("-", " ")}</span>
                <span className="ml-2">({count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day of Week Distribution */}
        <div>
          <h3 className="font-medium mb-3">Jobs by Day of Week</h3>
          <div className="flex gap-2 items-end h-24">
            {data.distribution.byDayOfWeek.labels.map((day, index) => {
              const value = data.distribution.byDayOfWeek.data[index]
              const max = Math.max(...data.distribution.byDayOfWeek.data, 1)
              const height = (value / max) * 100

              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${height}%`, minHeight: value > 0 ? "4px" : "0" }}
                    title={`${value} jobs`}
                  />
                  <span className="text-xs text-gray-500">{day}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Performers */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Employees */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Employees
            </h3>
            {data.rankings.topEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {data.rankings.topEmployees.slice(0, 5).map((employee, index) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : index === 1
                            ? "bg-gray-200 text-gray-700"
                            : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium">{employee.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{employee.completed} jobs</div>
                      <div className="text-xs text-muted-foreground">
                        {currencySymbol}{employee.revenue.toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Top Customers
            </h3>
            {data.rankings.topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              <div className="space-y-2">
                {data.rankings.topCustomers.slice(0, 5).map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : index === 1
                            ? "bg-gray-200 text-gray-700"
                            : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{customer.jobs} jobs</div>
                      <div className="text-xs text-muted-foreground">
                        {currencySymbol}{customer.revenue.toFixed(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
