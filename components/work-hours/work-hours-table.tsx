"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Edit2, Loader2 } from "lucide-react"

interface EmployeeOption {
  id: number
  firstName: string
  lastName: string
  role?: string | null
  status?: string | null
}

interface WorkHoursData {
  id: number
  name: string
  role: string
  regularHours: number
  overtime: number
  totalHours: number
  status: string
}

interface WorkHoursTableProps {
  startDate: Date
  endDate: Date
  rangeLabel: string
  employeeId: number | null
  employees: EmployeeOption[]
}

export function WorkHoursTable({ startDate, endDate, rangeLabel, employeeId, employees }: WorkHoursTableProps) {
  const [hours, setHours] = useState<WorkHoursData[]>([])
  const [loading, setLoading] = useState(true)

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

  const selectedEmployeeName = useMemo(() => {
    if (!employeeId) return null
    const employee = employees.find((emp) => emp.id === employeeId)
    return employee ? `${employee.firstName} ${employee.lastName}`.trim() : `Employee #${employeeId}`
  }, [employeeId, employees])

  const title = selectedEmployeeName ? `${selectedEmployeeName} Hours (${rangeLabel})` : `Staff Hours (${rangeLabel})`

  useEffect(() => {
    fetchWorkHours()
    const interval = setInterval(fetchWorkHours, 60000)
    return () => clearInterval(interval)
  }, [startDate, endDate, employeeId, employees])

  const fetchWorkHours = async () => {
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

      const employeesToShow = employeeId
        ? employees.filter((emp) => emp.id === employeeId)
        : employees

      const sortedSessions = [...sessions].sort((a: any, b: any) => {
        const aStart = new Date(a.startedAt || a.startTime || 0).getTime()
        const bStart = new Date(b.startedAt || b.startTime || 0).getTime()
        return aStart - bStart
      })

      const regularHoursByEmployee: Record<number, number> = {}
      const overtimeHoursByEmployee: Record<number, number> = {}

      // Regular hours: completed jobs only
      completedJobs.forEach((job: any) => {
        if (!isWithinRange(job.completedAt)) return
        const empId = Number(job.employee?.id ?? job.assignedTo ?? job.employeeId)
        if (!empId) return
        const jobHours = getJobHours(job)
        if (jobHours <= 0) return
        regularHoursByEmployee[empId] = (regularHoursByEmployee[empId] || 0) + jobHours
      })

      // Overtime: hours above 40h per employee based on work sessions
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

      // Map to display format
      const hoursData: WorkHoursData[] = employeesToShow.map((emp: EmployeeOption) => {
        const regular = regularHoursByEmployee[emp.id] || 0
        const overtime = overtimeHoursByEmployee[emp.id] || 0
        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          role: emp.role || "Employee",
          regularHours: Math.round(regular * 10) / 10,
          overtime: Math.round(overtime * 10) / 10,
          totalHours: Math.round((regular + overtime) * 10) / 10,
          status: regular + overtime > 0 ? "approved" : "pending",
        }
      }).filter((emp: WorkHoursData) => {
        if (employeeId) return true
        return emp.totalHours > 0 || employeesToShow.length <= 10
      })

      if (hoursData.length > 0) {
        setHours(hoursData)
        return
      }

      const fallback = employeesToShow.slice(0, employeeId ? 1 : 5).map((emp: EmployeeOption) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role || "Employee",
        regularHours: 0,
        overtime: 0,
        totalHours: 0,
        status: "pending",
      }))
      setHours(fallback)
    } catch (error) {
      console.error("Failed to fetch work hours:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {hours.map((employee) => {
            const initials = employee.name.split(" ").map((n) => n[0]).join("")
            return (
              <Card key={employee.id} className="border-muted">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">{employee.role}</div>
                      </div>
                    </div>
                    <Badge
                      variant={employee.status === "approved" ? "default" : "secondary"}
                      className={employee.status === "approved" ? "bg-chart-2" : ""}
                    >
                      {employee.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md border px-2 py-2 text-center">
                      <div className="text-muted-foreground">Regular</div>
                      <div className="font-semibold">{employee.regularHours}h</div>
                    </div>
                    <div className="rounded-md border px-2 py-2 text-center">
                      <div className="text-muted-foreground">Overtime</div>
                      <div className="font-semibold">{employee.overtime}h</div>
                    </div>
                    <div className="rounded-md border px-2 py-2 text-center">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-semibold">{employee.totalHours}h</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Regular Hours</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((employee) => {
                const initials = employee.name.split(" ").map((n) => n[0]).join("")

                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{employee.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{employee.role}</TableCell>
                    <TableCell className="text-right font-medium">{employee.regularHours}h</TableCell>
                    <TableCell className="text-right font-medium">{employee.overtime}h</TableCell>
                    <TableCell className="text-right font-bold">{employee.totalHours}h</TableCell>
                    <TableCell>
                      <Badge
                        variant={employee.status === "approved" ? "default" : "secondary"}
                        className={employee.status === "approved" ? "bg-chart-2" : ""}
                      >
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
