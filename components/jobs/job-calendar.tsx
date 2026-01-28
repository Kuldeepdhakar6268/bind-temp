"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
  Users,
  List,
  RefreshCw,
} from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns"
import { toast } from "sonner"

interface CalendarEvent {
  id: number
  title: string
  start: string
  end: string
  status: string
  priority: string
  color: string
  resourceId: number | null
  extendedProps: {
    customer: {
      id: number
      name: string
      email: string
    } | null
    assignee: {
      id: number
      name: string
    } | null
    location: string | null
    city: string | null
    postcode: string | null
    estimatedPrice: string | null
    currency: string | null
    durationMinutes: number | null
  }
}

interface Resource {
  id: number
  title: string
  role: string | null
  color: string
}

interface JobCalendarProps {
  onJobClick?: (jobId: number) => void
  onDateClick?: (date: Date) => void
  onJobDrop?: (jobId: number, newDate: Date, employeeId?: number) => void
}

export function JobCalendar({ onJobClick, onDateClick, onJobDrop }: JobCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day" | "team">("month")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    let start: Date
    let end: Date

    switch (view) {
      case "month":
        start = startOfWeek(startOfMonth(currentDate))
        end = endOfWeek(endOfMonth(currentDate))
        break
      case "week":
        start = startOfWeek(currentDate)
        end = endOfWeek(currentDate)
        break
      case "day":
        start = currentDate
        end = currentDate
        break
      case "team":
        start = startOfWeek(currentDate)
        end = endOfWeek(currentDate)
        break
      default:
        start = startOfWeek(startOfMonth(currentDate))
        end = endOfWeek(endOfMonth(currentDate))
    }

    return { start, end }
  }, [currentDate, view])

  // Fetch calendar data
  useEffect(() => {
    fetchCalendarData()
  }, [dateRange, selectedEmployee])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCalendarData(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [dateRange, selectedEmployee])

  const fetchCalendarData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        view,
      })

      if (selectedEmployee !== "all") {
        params.append("employeeId", selectedEmployee)
      }

      const response = await fetch(`/api/jobs/calendar?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch calendar data")

      const data = await response.json()
      setEvents(data.events || [])
      setResources(data.resources || [])
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [dateRange, view, selectedEmployee])

  const handleRefresh = useCallback(() => {
    fetchCalendarData()
    toast.success("Calendar refreshed")
  }, [fetchCalendarData])

  // Navigation handlers
  const goToToday = () => setCurrentDate(new Date())

  const goToPrevious = () => {
    switch (view) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1))
        break
      case "week":
      case "team":
        setCurrentDate(subWeeks(currentDate, 1))
        break
      case "day":
        setCurrentDate(subDays(currentDate, 1))
        break
    }
  }

  const goToNext = () => {
    switch (view) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1))
        break
      case "week":
      case "team":
        setCurrentDate(addWeeks(currentDate, 1))
        break
      case "day":
        setCurrentDate(addDays(currentDate, 1))
        break
    }
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, date)
    })
  }

  // Get events for a specific employee
  const getEventsForEmployee = (employeeId: number, date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return event.resourceId === employeeId && isSameDay(eventDate, date)
    })
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (view === "day") {
      return [currentDate]
    }
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
  }, [dateRange, view, currentDate])

  // Render event badge
  const renderEvent = (event: CalendarEvent) => {
    const currencySymbol = event.extendedProps.currency === "GBP" ? "£" : 
                          event.extendedProps.currency === "EUR" ? "€" : "$"

    return (
      <div
        key={event.id}
        onClick={(e) => {
          e.stopPropagation()
          onJobClick?.(event.id)
        }}
        className="text-xs p-1 rounded mb-1 cursor-pointer truncate hover:opacity-80"
        style={{ backgroundColor: event.color + "20", borderLeft: `3px solid ${event.color}` }}
        title={`${event.title} - ${event.extendedProps.customer?.name || "No customer"}`}
      >
        <div className="flex items-center gap-1">
          <span className="font-medium truncate">{format(new Date(event.start), "HH:mm")}</span>
          <span className="truncate">{event.title}</span>
        </div>
        {event.extendedProps.customer && (
          <div className="text-gray-500 truncate">{event.extendedProps.customer.name}</div>
        )}
      </div>
    )
  }

  // Render month view
  const renderMonthView = () => {
    const weeks: Date[][] = []
    let currentWeek: Date[] = []

    calendarDays.forEach((day, index) => {
      currentWeek.push(day)
      if ((index + 1) % 7 === 0) {
        weeks.push(currentWeek)
        currentWeek = []
      }
    })

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day) => {
              const dayEvents = getEventsForDate(day)
              const isCurrentMonth = isSameMonth(day, currentDate)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDateClick?.(day)}
                  className={`min-h-[100px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-gray-50 ${
                    !isCurrentMonth ? "bg-gray-50" : ""
                  }`}
                >
                  <div
                    className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday(day)
                        ? "bg-blue-600 text-white"
                        : !isCurrentMonth
                        ? "text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(renderEvent)}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 pl-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  // Render week view
  const renderWeekView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const weekDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-8 bg-gray-50 border-b">
          <div className="p-2 text-center text-sm font-medium text-gray-600 border-r">Time</div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-r last:border-r-0 ${
                isToday(day) ? "bg-blue-50" : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-600">{format(day, "EEE")}</div>
              <div
                className={`text-lg font-bold ${
                  isToday(day) ? "text-blue-600" : "text-gray-900"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
              <div className="p-2 text-xs text-gray-500 border-r bg-gray-50">
                {format(new Date().setHours(hour, 0), "HH:mm")}
              </div>
              {weekDays.map((day) => {
                const dayEvents = getEventsForDate(day).filter((event) => {
                  const eventHour = new Date(event.start).getHours()
                  return eventHour === hour
                })

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => {
                      const clickedDate = new Date(day)
                      clickedDate.setHours(hour)
                      onDateClick?.(clickedDate)
                    }}
                    className="min-h-[50px] p-1 border-r last:border-r-0 hover:bg-gray-50 cursor-pointer"
                  >
                    {dayEvents.map(renderEvent)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render team view (resource view)
  const renderTeamView = () => {
    const weekDays = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })

    return (
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid" style={{ gridTemplateColumns: `150px repeat(${weekDays.length}, 1fr)` }}>
          <div className="p-2 text-center text-sm font-medium text-gray-600 border-r bg-gray-50">
            Team Member
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-2 text-center border-r last:border-r-0 bg-gray-50 ${
                isToday(day) ? "bg-blue-50" : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-600">{format(day, "EEE")}</div>
              <div className="text-lg font-bold text-gray-900">{format(day, "d")}</div>
            </div>
          ))}
        </div>

        {/* Team rows */}
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="grid border-t"
            style={{ gridTemplateColumns: `150px repeat(${weekDays.length}, 1fr)` }}
          >
            <div className="p-2 border-r bg-gray-50 flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: resource.color }}
              />
              <span className="text-sm font-medium truncate">{resource.title}</span>
            </div>
            {weekDays.map((day) => {
              const dayEvents = getEventsForEmployee(resource.id, day)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDateClick?.(day)}
                  className="min-h-[80px] p-1 border-r last:border-r-0 hover:bg-gray-50 cursor-pointer"
                >
                  {dayEvents.map(renderEvent)}
                </div>
              )
            })}
          </div>
        ))}

        {/* Unassigned row */}
        <div
          className="grid border-t"
          style={{ gridTemplateColumns: `150px repeat(${weekDays.length}, 1fr)` }}
        >
          <div className="p-2 border-r bg-gray-100 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-sm font-medium text-gray-600">Unassigned</span>
          </div>
          {weekDays.map((day) => {
            const dayEvents = events.filter((event) => {
              const eventDate = new Date(event.start)
              return !event.resourceId && isSameDay(eventDate, day)
            })

            return (
              <div
                key={day.toISOString()}
                className="min-h-[80px] p-1 border-r last:border-r-0 bg-gray-50 hover:bg-gray-100 cursor-pointer"
              >
                {dayEvents.map(renderEvent)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Render day view
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b p-4 text-center">
          <div className="text-lg font-bold text-gray-900">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour) => {
            const hourEvents = getEventsForDate(currentDate).filter((event) => {
              const eventHour = new Date(event.start).getHours()
              return eventHour === hour
            })

            return (
              <div key={hour} className="flex border-b last:border-b-0">
                <div className="w-20 p-2 text-sm text-gray-500 border-r bg-gray-50 shrink-0">
                  {format(new Date().setHours(hour, 0), "HH:mm")}
                </div>
                <div
                  onClick={() => {
                    const clickedDate = new Date(currentDate)
                    clickedDate.setHours(hour)
                    onDateClick?.(clickedDate)
                  }}
                  className="flex-1 min-h-[60px] p-2 hover:bg-gray-50 cursor-pointer"
                >
                  {hourEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onJobClick?.(event.id)
                      }}
                      className="p-2 rounded mb-2 cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: event.color + "20", borderLeft: `4px solid ${event.color}` }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{event.title}</div>
                          {event.extendedProps.customer && (
                            <div className="text-sm text-gray-600">
                              {event.extendedProps.customer.name}
                            </div>
                          )}
                          {event.extendedProps.location && (
                            <div className="text-sm text-gray-500">
                              📍 {event.extendedProps.location}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {format(new Date(event.start), "HH:mm")} - {format(new Date(event.end), "HH:mm")}
                          </div>
                          {event.extendedProps.assignee && (
                            <div className="text-sm text-gray-600">
                              👤 {event.extendedProps.assignee.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Schedule
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-lg font-semibold">
              {view === "day"
                ? format(currentDate, "MMMM d, yyyy")
                : format(currentDate, "MMMM yyyy")}
            </h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh calendar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All team members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All team members</SelectItem>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id.toString()}>
                    {resource.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg">
              <Button
                variant={view === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("month")}
                className="rounded-r-none"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("week")}
                className="rounded-none border-x"
              >
                Week
              </Button>
              <Button
                variant={view === "day" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("day")}
                className="rounded-none"
              >
                Day
              </Button>
              <Button
                variant={view === "team" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("team")}
                className="rounded-l-none"
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : (
          <>
            {view === "month" && renderMonthView()}
            {view === "week" && renderWeekView()}
            {view === "day" && renderDayView()}
            {view === "team" && renderTeamView()}
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3B82F6" }} />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#10B981" }} />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#EF4444" }} />
            <span>Cancelled</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
