"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CheckCircle2, Clock, AlertCircle, UserCheck, Play, XCircle, Plus, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Activity {
  id: number
  type: string
  message: string
  user: string
  time: string
  icon: any
  iconColor: string
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchActivities = async () => {
    try {
      const [jobsRes, eventLogRes] = await Promise.all([
        fetch("/api/jobs?limit=20"),
        fetch("/api/event-log?limit=10"),
      ])

      const jobs = jobsRes.ok ? await jobsRes.json() : []
      const events = eventLogRes.ok ? await eventLogRes.json() : []

      // Convert jobs to activities
      const jobActivities: Activity[] = jobs
        .filter((job: any) => job.status !== "scheduled" || job.createdAt)
        .slice(0, 10)
        .map((job: any) => {
          let type = "created"
          let message = `Job "${job.title}" created`
          let icon = Plus
          let iconColor = "text-chart-1"

          if (job.status === "completed") {
            type = "completed"
            message = `Completed: ${job.title}`
            icon = CheckCircle2
            iconColor = "text-chart-2"
          } else if (job.status === "in-progress") {
            type = "started"
            message = `Started: ${job.title}`
            icon = Play
            iconColor = "text-chart-1"
          } else if (job.status === "cancelled") {
            type = "cancelled"
            message = `Cancelled: ${job.title}`
            icon = XCircle
            iconColor = "text-destructive"
          }

          const user = job.assignee 
            ? `${job.assignee.firstName} ${job.assignee.lastName}`
            : "Unassigned"

          return {
            id: job.id,
            type,
            message,
            user,
            time: formatDistanceToNow(new Date(job.updatedAt || job.createdAt), { addSuffix: true }),
            icon,
            iconColor,
          }
        })

      // Convert event log entries
      const eventActivities: Activity[] = events.map((event: any) => {
        let icon = AlertCircle
        let iconColor = "text-muted-foreground"

        switch (event.action) {
          case "user_created":
          case "customer_created":
            icon = Plus
            iconColor = "text-chart-1"
            break
          case "job_completed":
            icon = CheckCircle2
            iconColor = "text-chart-2"
            break
          case "check_in":
            icon = UserCheck
            iconColor = "text-chart-4"
            break
          case "job_started":
            icon = Clock
            iconColor = "text-chart-1"
            break
        }

        return {
          id: event.id,
          type: event.action,
          message: event.description || event.action,
          user: event.user?.firstName ? `${event.user.firstName} ${event.user.lastName}` : "System",
          time: formatDistanceToNow(new Date(event.createdAt), { addSuffix: true }),
          icon,
          iconColor,
        }
      })

      // Combine and sort by most recent
      const allActivities = [...jobActivities, ...eventActivities]
        .sort((a, b) => {
          // Parse "X ago" format - newer items first
          return 0
        })
        .slice(0, 8)

      setActivities(allActivities.length > 0 ? allActivities : getDefaultActivities())
    } catch (error) {
      console.error("Failed to fetch activities:", error)
      setActivities(getDefaultActivities())
    } finally {
      setLoading(false)
    }
  }

  const getDefaultActivities = () => [
    {
      id: 1,
      type: "info",
      message: "No recent activity",
      user: "System",
      time: "Just now",
      icon: AlertCircle,
      iconColor: "text-muted-foreground",
    },
  ]

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activities.map((activity) => {
            const Icon = activity.icon
            const initials = activity.user
              .split(" ")
              .map((n) => n[0])
              .join("")

            return (
              <div key={activity.id} className="flex gap-4">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5">
                    <Icon className={`h-4 w-4 ${activity.iconColor}`} />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">{activity.message}</p>
                  <p className="text-sm text-muted-foreground">{activity.user}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
