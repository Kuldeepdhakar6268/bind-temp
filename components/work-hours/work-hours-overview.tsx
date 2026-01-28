"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useIsMobile } from "@/components/ui/use-mobile"
import { Loader2 } from "lucide-react"
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns"

interface EmployeeOption {
  id: number
  firstName: string
  lastName: string
  status?: string | null
}

interface WorkHoursOverviewProps {
  startDate: Date
  endDate: Date
  rangeLabel: string
  employeeId: number | null
  employees: EmployeeOption[]
}

interface ChartRow {
  day: string
  regular: number
  overtime: number
}

export function WorkHoursOverview({ startDate, endDate, rangeLabel, employeeId, employees }: WorkHoursOverviewProps) {
  const isMobile = useIsMobile()
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [loading, setLoading] = useState(true)

  const selectedEmployees = useMemo(() => {
    if (employeeId) {
      const match = employees.find((emp) => emp.id === employeeId)
      return match ? [match] : []
    }
    return employees
  }, [employeeId, employees])

  const dayCount = Math.max(1, differenceInCalendarDays(startOfDay(endDate), startOfDay(startDate)) + 1)
  const dayLabelFormat = dayCount <= 7 ? "EEE" : "d MMM"

  const chartTitle = employeeId ? `Hours Breakdown (${rangeLabel})` : `Team Hours Breakdown (${rangeLabel})`

  const isWithinRange = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return false
    const date = new Date(dateValue)
    return date >= startDate && date <= endDate
  }

  const getJobHours = (job: any) => {
    const durationMinutes = Number(job.jobDuration ?? job.durationMinutes ?? 0)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0
    return durationMinutes / 60
  }

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        if (employeeId) {
          params.set("employeeId", String(employeeId))
        }

        const [sessionsRes, completedJobsRes] = await Promise.all([
          fetch(`/api/work-sessions?${params.toString()}`),
          fetch(`/api/jobs/completed${employeeId ? `?employeeId=${employeeId}` : ""}`),
        ])

        const sessions = sessionsRes.ok ? await sessionsRes.json() : []
        const completedJobsPayload = completedJobsRes.ok ? await completedJobsRes.json() : { jobs: [] }
        const completedJobs = Array.isArray(completedJobsPayload?.jobs) ? completedJobsPayload.jobs : []

        const buckets: Record<string, ChartRow> = {}
        for (let i = 0; i < dayCount; i++) {
          const day = addDays(startOfDay(startDate), i)
          const key = format(day, "yyyy-MM-dd")
          buckets[key] = {
            day: format(day, dayLabelFormat),
            regular: 0,
            overtime: 0,
          }
        }

        const sortedSessions = [...sessions].sort((a: any, b: any) => {
          const aStart = new Date(a.startedAt || a.startTime || 0).getTime()
          const bStart = new Date(b.startedAt || b.startTime || 0).getTime()
          return aStart - bStart
        })

        // Regular hours: sum of completed jobs only (within range)
        completedJobs.forEach((job: any) => {
          if (!isWithinRange(job.completedAt)) return
          const hoursWorked = getJobHours(job)
          if (hoursWorked <= 0) return
          const key = format(startOfDay(new Date(job.completedAt)), "yyyy-MM-dd")
          if (!buckets[key]) return
          buckets[key].regular += hoursWorked
        })

        // Overtime: hours above 40h per employee based on work sessions
        const employeeAccumulatedHours: Record<number, number> = {}

        sortedSessions.forEach((session: any) => {
          const startedAt = session.startedAt || session.startTime
          const endedAt = session.endedAt || session.endTime
          if (!startedAt) return

          let hoursWorked = 0
          if (endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          } else if (session.durationMinutes) {
            hoursWorked = Number(session.durationMinutes) / 60
          }

          const empId = Number(session.employeeId)
          const previousTotal = employeeAccumulatedHours[empId] || 0
          const nextTotal = previousTotal + hoursWorked
          const previousOvertime = Math.max(0, previousTotal - 40)
          const nextOvertime = Math.max(0, nextTotal - 40)
          const overtimeAdd = Math.max(0, nextOvertime - previousOvertime)

          employeeAccumulatedHours[empId] = nextTotal

          const key = format(startOfDay(new Date(startedAt)), "yyyy-MM-dd")
          if (!buckets[key]) return
          buckets[key].overtime += overtimeAdd
        })

        const nextChartData = Object.entries(buckets).map(([, row]) => ({
          day: row.day,
          regular: Math.round(row.regular * 10) / 10,
          overtime: Math.round(row.overtime * 10) / 10,
        }))
        setChartData(nextChartData)
      } catch (error) {
        console.error("Failed to load work hours overview:", error)
        setChartData([])
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [startDate, endDate, employeeId, dayCount, dayLabelFormat])

  const totals = useMemo(() => {
    const regular = chartData.reduce((sum, row) => sum + row.regular, 0)
    const overtime = chartData.reduce((sum, row) => sum + row.overtime, 0)
    const total = regular + overtime
    const staffCount = Math.max(1, selectedEmployees.length || (employeeId ? 1 : 0))
    const avgPerStaff = total / staffCount
    return { regular, overtime, total, avgPerStaff, staffCount }
  }, [chartData, selectedEmployees.length, employeeId])

  const stats = useMemo(() => {
    const baseStats = [
      { title: "Total Hours", value: totals.total, subLabel: rangeLabel },
      { title: "Regular Hours", value: totals.regular, subLabel: "Completed jobs only" },
      { title: "Overtime", value: totals.overtime, subLabel: "Over 40h" },
    ]
    if (employeeId) {
      return baseStats
    }
    return [...baseStats, { title: "Avg per Staff", value: totals.avgPerStaff, subLabel: rangeLabel }]
  }, [totals, rangeLabel, employeeId])

  const formatHours = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: value < 100 ? 1 : 0 })

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.title}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <h3 className="text-lg sm:text-2xl font-bold">{formatHours(stat.value)}h</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.subLabel}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{chartTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [`${value}h`, ""]}
              />
              {!isMobile && <Legend />}
              <Bar dataKey="regular" fill="hsl(var(--chart-1))" name="Regular Hours" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overtime" fill="hsl(var(--chart-3))" name="Overtime" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
