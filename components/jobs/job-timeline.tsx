"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Clock, User, Camera, Calendar, Play, CheckCircle, XCircle, Mail, Bell, Copy, MessageSquare } from "lucide-react"
import { format } from "date-fns"

interface TimelineEvent {
  id: string
  type: string
  description: string
  timestamp: string
  metadata?: any
  icon: string
}

interface JobTimelineProps {
  jobId: number
}

export function JobTimeline({ jobId }: JobTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchTimeline()
  }, [jobId])

  const fetchTimeline = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/jobs/${jobId}/timeline`)
      if (!response.ok) throw new Error("Failed to fetch timeline")
      const data = await response.json()
      setTimeline(data.timeline || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "created":
        return <Calendar className="h-4 w-4" />
      case "job_assigned":
        return <User className="h-4 w-4" />
      case "job_started":
        return <Play className="h-4 w-4" />
      case "job_completed":
        return <CheckCircle className="h-4 w-4" />
      case "job_cancelled":
        return <XCircle className="h-4 w-4" />
      case "job_rescheduled":
        return <Calendar className="h-4 w-4" />
      case "job_duplicated":
        return <Copy className="h-4 w-4" />
      case "job_confirmation_sent":
      case "job_reminder_sent":
        return <Mail className="h-4 w-4" />
      case "clock_in":
      case "clock_out":
        return <Clock className="h-4 w-4" />
      case "check_out_comment":
        return <MessageSquare className="h-4 w-4" />
      case "photo_added":
        return <Camera className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case "created":
        return "bg-blue-100 text-blue-600 border-blue-200"
      case "job_assigned":
        return "bg-purple-100 text-purple-600 border-purple-200"
      case "job_started":
      case "clock_in":
        return "bg-amber-100 text-amber-600 border-amber-200"
      case "job_completed":
      case "clock_out":
        return "bg-green-100 text-green-600 border-green-200"
      case "job_cancelled":
        return "bg-red-100 text-red-600 border-red-200"
      case "job_rescheduled":
        return "bg-orange-100 text-orange-600 border-orange-200"
      case "job_confirmation_sent":
      case "job_reminder_sent":
        return "bg-cyan-100 text-cyan-600 border-cyan-200"
      case "photo_added":
        return "bg-pink-100 text-pink-600 border-pink-200"
      case "check_out_comment":
        return "bg-orange-100 text-orange-600 border-orange-200"
      default:
        return "bg-gray-100 text-gray-600 border-gray-200"
    }
  }

  const formatEventType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/job /g, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No activity recorded yet
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Timeline events */}
            <div className="space-y-6">
              {timeline.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Icon */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 ${getEventColor(
                      event.type
                    )}`}
                  >
                    {getIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {formatEventType(event.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), "MMM d, yyyy 'at' HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{event.description}</p>

                    {/* Metadata details */}
                    {event.metadata && (
                      <div className="mt-2 text-xs text-gray-500">
                        {event.metadata.comment && (
                          <div className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground">
                            <span className="font-medium">Comment:</span> {event.metadata.comment}
                          </div>
                        )}
                        {event.metadata.duration && (
                          <span className="inline-flex items-center gap-1 mr-3">
                            <Clock className="h-3 w-3" />
                            Duration: {event.metadata.duration} min
                          </span>
                        )}
                        {event.metadata.latitude && event.metadata.longitude && (
                          <span className="inline-flex items-center gap-1">
                            📍 Location recorded
                          </span>
                        )}
                        {event.metadata.photoUrl && (
                          <div className="mt-2">
                            <img
                              src={event.metadata.photoUrl}
                              alt="Job photo"
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
