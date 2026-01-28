"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  CheckCircle,
  Clock,
  Star,
  TrendingUp,
  Award,
  Calendar,
  Target,
  Briefcase,
} from "lucide-react"

interface Stats {
  summary: {
    totalJobs: number
    completedJobs: number
    inProgressJobs: number
    scheduledJobs: number
    cancelledJobs: number
    completionRate: number
    averageRating: number | null
    totalRatings: number
    fiveStarRatings: number
    onTimeRate: number
    totalHoursWorked: number
    thisWeekHours: number
  }
  weeklyData: { week: string; completed: number; total: number }[]
  ratingDistribution: { rating: number; count: number }[]
  period: string
}

export default function PerformancePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("month")

  useEffect(() => {
    fetchStats()
  }, [period])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employee/stats?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  const summary = stats?.summary
  const periodLabel =
    period === "week" ? "This Week" : period === "month" ? "This Month" : period === "year" ? "This Year" : "All Time"
  const hoursValue =
    period === "week" ? summary?.thisWeekHours || 0 : summary?.totalHoursWorked || 0

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">My Performance</h1>
          <p className="text-muted-foreground">Track your work stats and achievements</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jobs Completed</p>
                <p className="text-3xl font-bold">{summary?.completedJobs || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary?.inProgressJobs || 0} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-3xl font-bold">{summary?.completionRate || 0}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <Progress value={summary?.completionRate || 0} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">
                    {summary?.averageRating?.toFixed(1) || "—"}
                  </p>
                  {summary?.averageRating && (
                    <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {summary?.totalRatings || 0} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hours Worked</p>
                <p className="text-3xl font-bold">{hoursValue}h</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {periodLabel} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Jobs Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Weekly Progress
            </CardTitle>
            <CardDescription>Jobs completed over the last 4 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.weeklyData.map((week, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{week.week}</span>
                    <span className="text-muted-foreground">
                      {week.completed}/{week.total} jobs
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${week.total > 0 ? (week.completed / week.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Rating Breakdown
            </CardTitle>
            <CardDescription>Customer feedback distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {(summary?.totalRatings || 0) > 0 ? (
              <div className="space-y-3">
                {stats?.ratingDistribution.reverse().map((item) => (
                  <div key={item.rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16">
                      <span className="text-sm font-medium">{item.rating}</span>
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 rounded-full transition-all"
                        style={{
                          width: `${
                            summary?.totalRatings
                              ? (item.count / summary.totalRatings) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No ratings yet</p>
                <p className="text-sm">Complete jobs to receive customer ratings</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Job Status Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{summary?.totalJobs || 0}</p>
              <p className="text-sm text-muted-foreground">Total Jobs</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{summary?.completedJobs || 0}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{summary?.inProgressJobs || 0}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">{summary?.scheduledJobs || 0}</p>
              <p className="text-sm text-muted-foreground">Scheduled</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{summary?.cancelledJobs || 0}</p>
              <p className="text-sm text-muted-foreground">Cancelled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Achievements
          </CardTitle>
          <CardDescription>Milestones and badges earned</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(summary?.completedJobs || 0) >= 1 && (
              <Badge variant="secondary" className="py-2 px-3">
                🎯 First Job Completed
              </Badge>
            )}
            {(summary?.completedJobs || 0) >= 10 && (
              <Badge variant="secondary" className="py-2 px-3">
                ⭐ 10 Jobs Milestone
              </Badge>
            )}
            {(summary?.completedJobs || 0) >= 50 && (
              <Badge variant="secondary" className="py-2 px-3">
                🏆 50 Jobs Champion
              </Badge>
            )}
            {(summary?.completedJobs || 0) >= 100 && (
              <Badge variant="secondary" className="py-2 px-3">
                💯 Century Club
              </Badge>
            )}
            {(summary?.fiveStarRatings || 0) >= 5 && (
              <Badge variant="secondary" className="py-2 px-3">
                ⭐⭐⭐⭐⭐ Five Star Pro
              </Badge>
            )}
            {(summary?.completionRate || 0) >= 95 && (
              <Badge variant="secondary" className="py-2 px-3">
                🎖️ Reliability Expert
              </Badge>
            )}
            {(summary?.onTimeRate || 0) >= 95 && (
              <Badge variant="secondary" className="py-2 px-3">
                ⏰ Punctuality Pro
              </Badge>
            )}
            {(summary?.totalHoursWorked || 0) >= 100 && (
              <Badge variant="secondary" className="py-2 px-3">
                💪 100 Hours Hero
              </Badge>
            )}
            {(summary?.completedJobs || 0) === 0 && (
              <p className="text-muted-foreground text-sm">
                Complete jobs to unlock achievements!
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
