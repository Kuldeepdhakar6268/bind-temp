"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { WorkHoursOverview } from "@/components/work-hours/work-hours-overview"
import { WorkHoursTable } from "@/components/work-hours/work-hours-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, Download, Loader2 } from "lucide-react"
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { toast } from "sonner"

type PeriodKey = "this_week" | "today" | "this_month" | "custom"

interface EmployeeOption {
  id: number
  firstName: string
  lastName: string
  status?: string | null
}

export default function WorkHoursPage() {
  const [period, setPeriod] = useState<PeriodKey>("this_week")
  const [customStart, setCustomStart] = useState(format(new Date(), "yyyy-MM-dd"))
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"))
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [employeeFilter, setEmployeeFilter] = useState<string>("all")
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await fetch("/api/employees")
        const data = res.ok ? await res.json() : []
        const activeEmployees = (Array.isArray(data) ? data : [])
          .filter((emp: EmployeeOption) => (emp.status || "active") === "active")
          .sort((a: EmployeeOption, b: EmployeeOption) => {
            const nameA = `${a.firstName} ${a.lastName}`.trim()
            const nameB = `${b.firstName} ${b.lastName}`.trim()
            return nameA.localeCompare(nameB)
          })
        setEmployees(activeEmployees)
      } catch (error) {
        console.error("Failed to load employees for work hours filters:", error)
        setEmployees([])
      }
    }

    loadEmployees()
  }, [])

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()

    if (period === "today") {
      return { startDate: startOfDay(now), endDate: endOfDay(now) }
    }

    if (period === "this_month") {
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) }
    }

    if (period === "custom") {
      const parsedStart = customStart ? new Date(`${customStart}T00:00:00`) : startOfDay(now)
      const parsedEnd = customEnd ? new Date(`${customEnd}T23:59:59`) : endOfDay(parsedStart)
      if (parsedStart > parsedEnd) {
        return { startDate: parsedStart, endDate: endOfDay(parsedStart) }
      }
      return { startDate: parsedStart, endDate: parsedEnd }
    }

    return { startDate: startOfWeek(now), endDate: endOfWeek(now) }
  }, [period, customStart, customEnd])

  const parsedEmployeeId = employeeFilter === "all" ? null : Number(employeeFilter)
  const employeeId =
    parsedEmployeeId !== null && Number.isFinite(parsedEmployeeId) ? parsedEmployeeId : null

  const rangeLabel = useMemo(() => {
    if (period === "today") return "Today"
    if (period === "this_month") return "This Month"
    if (period === "this_week") return "This Week"
    return `${format(startDate, "d MMM yyyy")} - ${format(endDate, "d MMM yyyy")}`
  }, [period, startDate, endDate])

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

  const getEmployeeName = (id: number) => {
    const employee = employees.find((emp) => emp.id === id)
    return employee ? `${employee.firstName} ${employee.lastName}`.trim() : `Employee #${id}`
  }

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
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

      const employeesToExport = employeeId
        ? employees.filter((emp) => emp.id === employeeId)
        : employees

      if (employeesToExport.length === 0) {
        toast.error("No employees available to export")
        return
      }

      const regularHoursByEmployee: Record<number, number> = {}
      completedJobs.forEach((job: any) => {
        if (!isWithinRange(job.completedAt)) return
        const empId = Number(job.employee?.id ?? job.assignedTo ?? job.employeeId)
        if (!empId) return
        const jobHours = getJobHours(job)
        if (jobHours <= 0) return
        regularHoursByEmployee[empId] = (regularHoursByEmployee[empId] || 0) + jobHours
      })

      const sortedSessions = [...sessions].sort((a: any, b: any) => {
        const aStart = new Date(a.startedAt || a.startTime || 0).getTime()
        const bStart = new Date(b.startedAt || b.startTime || 0).getTime()
        return aStart - bStart
      })

      const overtimeHoursByEmployee: Record<number, number> = {}
      const accumulatedHoursByEmployee: Record<number, number> = {}

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
        const previousTotal = accumulatedHoursByEmployee[empId] || 0
        const nextTotal = previousTotal + hoursWorked
        const previousOvertime = Math.max(0, previousTotal - 40)
        const nextOvertime = Math.max(0, nextTotal - 40)
        const overtimeAdd = Math.max(0, nextOvertime - previousOvertime)

        accumulatedHoursByEmployee[empId] = nextTotal
        overtimeHoursByEmployee[empId] = (overtimeHoursByEmployee[empId] || 0) + overtimeAdd
      })

      const rows = employeesToExport.map((emp) => {
        const regular = regularHoursByEmployee[emp.id] || 0
        const overtime = overtimeHoursByEmployee[emp.id] || 0
        const total = regular + overtime
        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          regular,
          overtime,
          total,
        }
      })

      const totalRegular = rows.reduce((sum, row) => sum + row.regular, 0)
      const totalOvertime = rows.reduce((sum, row) => sum + row.overtime, 0)
      const totalHours = totalRegular + totalOvertime
      const avgPerStaff = rows.length > 0 ? totalHours / rows.length : 0

      const header = [
        "Employee",
        "Regular Hours (Completed Jobs)",
        "Overtime Hours (>40h)",
        "Total Hours",
        "Period Start",
        "Period End",
      ]

      const dataLines = rows.map((row) => [
        row.name,
        row.regular.toFixed(1),
        row.overtime.toFixed(1),
        row.total.toFixed(1),
        format(startDate, "yyyy-MM-dd"),
        format(endDate, "yyyy-MM-dd"),
      ])

      const summaryLines = employeeId
        ? []
        : [
            [],
            ["Summary", "", "", "", "", ""],
            ["Total Regular Hours", totalRegular.toFixed(1), "", "", "", ""],
            ["Total Overtime Hours", totalOvertime.toFixed(1), "", "", "", ""],
            ["Total Hours", totalHours.toFixed(1), "", "", "", ""],
            ["Average per Staff", avgPerStaff.toFixed(1), "", "", "", ""],
          ]

      const csvContent = [header, ...dataLines, ...summaryLines]
        .map((line) => line.join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const employeeLabel = employeeId ? getEmployeeName(employeeId).replace(/\s+/g, "-") : "all-employees"
      link.href = url
      link.download = `work-hours-${employeeLabel}-${format(startDate, "yyyy-MM-dd")}-${format(endDate, "yyyy-MM-dd")}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Work hours exported")
    } catch (error) {
      console.error("Failed to export work hours:", error)
      toast.error("Failed to export work hours")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Work Hours Overview</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Track employee working hours and attendance</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={period === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod("today")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Today
                </Button>
                <Button
                  variant={period === "this_week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod("this_week")}
                >
                  This Week
                </Button>
                <Button
                  variant={period === "this_month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod("this_month")}
                >
                  This Month
                </Button>
                <Button
                  variant={period === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod("custom")}
                >
                  Custom Range
                </Button>
              </div>
              {period === "custom" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-8 w-full sm:w-[150px]"
                  />
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-8 w-full sm:w-[150px]"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger size="sm" className="w-full sm:w-[220px]">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {`${emp.firstName} ${emp.lastName}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            </div>
          </div>
        </div>

        <WorkHoursOverview
          startDate={startDate}
          endDate={endDate}
          rangeLabel={rangeLabel}
          employeeId={employeeId}
          employees={employees}
        />

        <WorkHoursTable
          startDate={startDate}
          endDate={endDate}
          rangeLabel={rangeLabel}
          employeeId={employeeId}
          employees={employees}
        />
      </main>
    </div>
  )
}
