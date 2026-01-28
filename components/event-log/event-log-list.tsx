"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserPlus, UserCheck, FileText, Calendar, DollarSign, Settings, Loader2, Activity } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface EventItem {
  id: number
  type: string
  action: string
  user: string
  description: string
  timestamp: string
  icon: any
}

const typeColors: Record<string, string> = {
  user: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  job: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  invoice: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  schedule: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  payment: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  system: "bg-muted text-muted-foreground border-muted",
  customer: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  employee: "bg-chart-5/10 text-chart-5 border-chart-5/20",
}

const typeIcons: Record<string, any> = {
  user: UserPlus,
  job: UserCheck,
  invoice: FileText,
  schedule: Calendar,
  payment: DollarSign,
  system: Settings,
  customer: UserPlus,
  employee: UserCheck,
}

export function EventLogList() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/event-log?limit=20")
      if (response.ok) {
        const data = await response.json()
        
        const formattedEvents: EventItem[] = data.map((event: any) => ({
          id: event.id,
          type: event.entityType || event.type || "system",
          action: event.action || "Event",
          user: event.userName || event.user || "System",
          description: event.description || event.details || "",
          timestamp: event.createdAt ? formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }) : "Recently",
          icon: typeIcons[event.entityType || event.type] || Settings,
        }))
        
        setEvents(formattedEvents)
      }
    } catch (error) {
      console.error("Failed to fetch events:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No events recorded yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => {
          const Icon = event.icon
          const initials = event.user.split(" ").map((n) => n[0]).join("")

          return (
            <div
              key={event.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColors[event.type] || typeColors.system}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold">{event.action}</h4>
                  <span className="text-sm text-muted-foreground">{event.timestamp}</span>
                </div>
                <p className="text-sm text-muted-foreground">{event.description}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">by {event.user}</span>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
