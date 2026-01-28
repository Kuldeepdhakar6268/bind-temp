"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Clock, MapPin, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { format, isToday, parseISO, differenceInMinutes, startOfDay, setHours } from "date-fns"

interface WorkSession {
  id: number
  employeeId: number
  jobId: number | null
  startedAt: string
  endedAt: string | null
  durationMinutes: number | null
  notes: string | null
  employee: {
    id: number
    firstName: string
    lastName: string
    email: string
  }
  job: {
    id: number
    title: string
    address: string
    scheduledStart: string | null
  } | null
}

interface CheckIn {
  id: number
  staff: string
  location: string
  checkInTime: string
  checkOutTime: string | null
  status: "active" | "completed" | "late"
  address: string
}

export function CheckInList() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCheckIns() {
      try {
        // Get today's date range
        const today = startOfDay(new Date())
        const startDate = today.toISOString()
        
        const response = await fetch(`/api/work-sessions?startDate=${encodeURIComponent(startDate)}`)
        if (!response.ok) throw new Error("Failed to fetch check-ins")
        
        const sessions: WorkSession[] = await response.json()
        
        // Transform sessions to check-ins format
        const transformed: CheckIn[] = sessions
          .filter(session => isToday(parseISO(session.startedAt)))
          .map(session => {
            const startTime = parseISO(session.startedAt)
            const endTime = session.endedAt ? parseISO(session.endedAt) : null
            
            // Determine status
            let status: "active" | "completed" | "late" = "active"
            if (endTime) {
              status = "completed"
            } else if (session.job?.scheduledStart) {
              const scheduledStart = parseISO(session.job.scheduledStart)
              // If clocked in more than 15 minutes after scheduled start, mark as late
              if (differenceInMinutes(startTime, scheduledStart) > 15) {
                status = "late"
              }
            }

            return {
              id: session.id,
              staff: `${session.employee.firstName} ${session.employee.lastName}`,
              location: session.job?.title || "General Work",
              checkInTime: format(startTime, "HH:mm"),
              checkOutTime: endTime ? format(endTime, "HH:mm") : null,
              status,
              address: session.job?.address || "No location specified",
            }
          })

        setCheckIns(transformed)
      } catch (err) {
        console.error("Error fetching check-ins:", err)
        setError("Failed to load check-ins")
      } finally {
        setLoading(false)
      }
    }

    fetchCheckIns()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Check-ins</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Check-ins</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (checkIns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Check-ins</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          No check-ins recorded today
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Check-ins</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {checkIns.map((checkIn) => {
          const initials = checkIn.staff
            .split(" ")
            .map((n) => n[0])
            .join("")

          const statusConfig = {
            active: { color: "bg-chart-1 text-white", icon: CheckCircle2 },
            completed: { color: "bg-chart-2 text-white", icon: CheckCircle2 },
            late: { color: "bg-destructive text-white", icon: AlertCircle },
          }

          const config = statusConfig[checkIn.status]
          const StatusIcon = config.icon

          return (
            <div key={checkIn.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="font-semibold">{checkIn.staff}</h4>
                      <p className="text-sm font-medium text-muted-foreground">{checkIn.location}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {checkIn.address}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-chart-2" />
                        <span className="text-muted-foreground">In:</span>
                        <span className="font-medium">{checkIn.checkInTime}</span>
                      </div>
                      {checkIn.checkOutTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-chart-4" />
                          <span className="text-muted-foreground">Out:</span>
                          <span className="font-medium">{checkIn.checkOutTime}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Badge className={config.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {checkIn.status}
                </Badge>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
