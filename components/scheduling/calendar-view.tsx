"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Loader2, Pencil, Clock, GripVertical, UserMinus, Flag } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { EditJobDialog } from "@/components/jobs/edit-job-dialog"
import { JobCornerActions } from "@/components/jobs/job-corner-actions"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  addMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  setHours,
  setMinutes,
  differenceInMinutes,
} from "date-fns"

interface CalendarEvent {
  id: number
  title: string
  start: string
  end: string
  status: string
  color: string
  extendedProps: {
    customer?: { name: string } | null
    assignee?: { name: string } | null
  }
}

export function CalendarView() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [rangeType, setRangeType] = useState<"today" | "week" | "month" | "date" | "range">("week")
  const [customDate, setCustomDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [customRangeStart, setCustomRangeStart] = useState("")
  const [customRangeEnd, setCustomRangeEnd] = useState("")
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [timeOffByDate, setTimeOffByDate] = useState<Record<string, { employees: { id: number; name: string; type: string }[] }>>({})
  const [publicHolidaysByDate, setPublicHolidaysByDate] = useState<Record<string, { title: string }[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedJobForEdit, setSelectedJobForEdit] = useState<any>(null)
  const [loadingJobEdit, setLoadingJobEdit] = useState(false)
  const [draggingJobId, setDraggingJobId] = useState<number | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "timeline">("timeline")
  const [dropTargetSlot, setDropTargetSlot] = useState<{ hour: number; minute: number } | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  const normalizeStatus = (status: string | null | undefined) =>
    String(status ?? "")
      .toLowerCase()
      .replace(/_/g, "-")

  const formatStatusLabel = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status)
    if (!normalized) return "unknown"
    return normalized.replace(/-/g, " ")
  }

  const getStatusCardClass = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status)
    const statusClasses: Record<string, string> = {
      completed: "border-green-400 bg-green-100",
      "in-progress": "border-yellow-400 bg-yellow-100",
      scheduled: "border-blue-400 bg-blue-100",
      pending: "border-red-400 bg-red-100",
      cancelled: "border-rose-400 bg-rose-100",
      rejected: "border-gray-400 bg-gray-100",
      paused: "border-amber-400 bg-amber-100",
      assigned: "border-indigo-400 bg-indigo-100",
      active: "border-emerald-400 bg-emerald-100",
      verified: "border-teal-400 bg-teal-100",
    }
    return statusClasses[normalized] ?? "border-slate-300 bg-slate-100"
  }

  const getStatusBadgeClass = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status)
    const badgeClasses: Record<string, string> = {
      completed: "bg-green-600 text-white",
      "in-progress": "bg-yellow-500 text-white",
      scheduled: "bg-blue-600 text-white",
      pending: "bg-red-600 text-white",
      cancelled: "bg-rose-600 text-white",
      rejected: "bg-gray-600 text-white",
      paused: "bg-amber-600 text-white",
      assigned: "bg-indigo-600 text-white",
      active: "bg-emerald-600 text-white",
      verified: "bg-teal-600 text-white",
    }
    return badgeClasses[normalized] ?? "bg-slate-600 text-white"
  }

  const normalizeAddressPart = (value?: string | null) =>
    String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

  const formatAddress = (location?: string | null, city?: string | null, postcode?: string | null) => {
    const base = location || ""
    const normalizedBase = normalizeAddressPart(base)
    const parts: string[] = []
    if (location) parts.push(location)
    if (city && !normalizedBase.includes(normalizeAddressPart(city))) {
      parts.push(city)
    }
    if (postcode && !normalizedBase.includes(normalizeAddressPart(postcode))) {
      parts.push(postcode)
    }
    return parts.filter(Boolean).join(", ")
  }

  // Generate time slots for full 24 hours in 30-min intervals
  const timeSlots = useMemo(() => {
    const slots: { hour: number; minute: number; label: string }[] = []
    for (let hour = 0; hour <= 23; hour++) {
      slots.push({ hour, minute: 0, label: format(setMinutes(setHours(new Date(), hour), 0), "HH:mm") })
      if (hour < 23) {
        slots.push({ hour, minute: 30, label: format(setMinutes(setHours(new Date(), hour), 30), "HH:mm") })
      }
    }
    return slots
  }, [])

  const dateRange = useMemo(() => {
    if (rangeType === "today") {
      const start = startOfDay(currentDate)
      const end = endOfDay(currentDate)
      return { start, end }
    }
    if (rangeType === "week") {
      const start = startOfWeek(currentDate)
      const end = endOfWeek(currentDate)
      return { start, end }
    }
    if (rangeType === "date") {
      const selected = new Date(customDate)
      const start = startOfDay(selected)
      const end = endOfDay(selected)
      return { start, end }
    }
    if (rangeType === "range") {
      const start = customRangeStart ? startOfDay(new Date(customRangeStart)) : startOfDay(currentDate)
      const end = customRangeEnd ? endOfDay(new Date(customRangeEnd)) : endOfDay(currentDate)
      return { start, end }
    }
    const start = startOfWeek(startOfMonth(currentDate))
    const end = endOfWeek(endOfMonth(currentDate))
    return { start, end }
  }, [currentDate, customDate, rangeType])

  useEffect(() => {
    fetchCalendarData()
  }, [dateRange])

  useEffect(() => {
    const handleJobsUpdated = () => {
      fetchCalendarData()
    }
    window.addEventListener("jobs:updated", handleJobsUpdated)
    return () => window.removeEventListener("jobs:updated", handleJobsUpdated)
  }, [dateRange])

  useEffect(() => {
    if (!dayDialogOpen) {
      setSelectedHour(null)
    }
  }, [dayDialogOpen])

  const fetchCalendarData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        view: "month",
      })

      const response = await fetch(`/api/jobs/calendar?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
        setTimeOffByDate(data.timeOffByDate || {})
        setPublicHolidaysByDate(data.publicHolidaysByDate || {})
      }
    } catch (error) {
      console.error("Failed to fetch calendar data:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleEditJob = async (jobId: number) => {
    setLoadingJobEdit(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      if (response.ok) {
        const job = await response.json()
        setSelectedJobForEdit(job)
        setEditDialogOpen(true)
      }
    } catch (error) {
      console.error("Failed to fetch job for edit:", error)
    } finally {
      setLoadingJobEdit(false)
    }
  }

  const handleEditSuccess = () => {
    fetchCalendarData()
    setEditDialogOpen(false)
    setDayDialogOpen(false)
    window.dispatchEvent(new CustomEvent("jobs:updated"))
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, jobId: number, status: string) => {
    if (status === "completed") {
      e.preventDefault()
      return
    }
    setDraggingJobId(jobId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", jobId.toString())
  }

  const handleDragEnd = () => {
    setDraggingJobId(null)
    setDropTargetSlot(null)
  }

  const handleDragOver = (e: React.DragEvent, hour: number, minute: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTargetSlot({ hour, minute })
  }

  const handleDragLeave = () => {
    setDropTargetSlot(null)
  }

  const handleDrop = async (e: React.DragEvent, hour: number, minute: number) => {
    e.preventDefault()
    setDropTargetSlot(null)
    
    const jobId = parseInt(e.dataTransfer.getData("text/plain"))
    if (!jobId || !selectedDay) return

    setRescheduling(true)
    setDraggingJobId(null)
    
    try {
      // Get the job's current duration
      const event = selectedDayEvents.find(ev => ev.id === jobId)
      if (!event) return
      
      const currentStart = new Date(event.start)
      const currentEnd = new Date(event.end)
      const durationMinutes = differenceInMinutes(currentEnd, currentStart)
      
      // Create new start time
      const newStart = setMinutes(setHours(selectedDay, hour), minute)
      const newEnd = addMinutes(newStart, durationMinutes)
      
      // Optimistic UI update - immediately move the job visually
      setEvents(prevEvents => prevEvents.map(ev => 
        ev.id === jobId 
          ? { ...ev, start: newStart.toISOString(), end: newEnd.toISOString() }
          : ev
      ))
      
      const response = await fetch(`/api/jobs/${jobId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDate: newStart.toISOString(),
          newEndDate: newEnd.toISOString(),
          reason: "Drag and drop reschedule from calendar",
        }),
      })
      
      if (response.ok) {
        toast.success(`Job rescheduled to ${format(newStart, "HH:mm")}`)
        // Refresh to get authoritative data from server (silent to avoid UI flash)
        await fetchCalendarData(true)
        window.dispatchEvent(new CustomEvent("jobs:updated"))
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to reschedule job")
        // Revert optimistic update on error
        await fetchCalendarData(true)
      }
    } catch (error) {
      console.error("Failed to reschedule job:", error)
      toast.error("Failed to reschedule job")
      // Revert optimistic update on error
      await fetchCalendarData(true)
    } finally {
      setRescheduling(false)
    }
  }

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
  }, [dateRange])

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return isSameDay(eventDate, day)
    })
  }

  const getTimeOffSummary = (dayKey: string) => {
    const dayData = timeOffByDate[dayKey]
    if (!dayData || dayData.employees.length === 0) return null
    const details = dayData.employees
      .map((employee) => `${employee.name}${employee.type ? ` (${employee.type})` : ""}`)
      .join(", ")
    return {
      count: dayData.employees.length,
      details,
    }
  }

  const getHolidaySummary = (dayKey: string) => {
    const holidays = publicHolidaysByDate[dayKey]
    if (!holidays || holidays.length === 0) return null
    return {
      count: holidays.length,
      details: holidays.map((holiday) => holiday.title).join(", "),
    }
  }

  const monthName =
    rangeType === "today"
      ? format(currentDate, "MMMM d, yyyy")
      : rangeType === "week"
        ? `Week of ${format(startOfWeek(currentDate), "MMM d, yyyy")}`
        : rangeType === "date"
          ? format(new Date(customDate), "MMMM d, yyyy")
          : format(currentDate, "MMMM yyyy")
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  const selectedHourStart = selectedDay && selectedHour !== null
    ? setMinutes(setHours(selectedDay, selectedHour), 0)
    : null
  const selectedHourEnd = selectedHourStart ? addHours(selectedHourStart, 1) : null

  const overlappingHourJobs = useMemo(() => {
    if (!selectedHourStart || !selectedHourEnd) return []
    return selectedDayEvents.filter((event) => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      return eventStart < selectedHourEnd && eventEnd > selectedHourStart
    })
  }, [selectedDayEvents, selectedHourStart, selectedHourEnd])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{monthName}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (rangeType === "week") {
                  setCurrentDate(addWeeks(currentDate, -1))
                } else if (rangeType === "today") {
                  setCurrentDate(addDays(currentDate, -1))
                } else if (rangeType === "date") {
                  const next = addDays(new Date(customDate), -1)
                  setCustomDate(format(next, "yyyy-MM-dd"))
                } else {
                  setCurrentDate(addMonths(currentDate, -1))
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={rangeType === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRangeType("today")
                setCurrentDate(new Date())
              }}
            >
              Today
            </Button>
            <Button
              variant={rangeType === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRangeType("week")
                setCurrentDate(new Date())
              }}
            >
              This Week
            </Button>
            <Button
              variant={rangeType === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRangeType("month")
                setCurrentDate(new Date())
              }}
            >
              This Month
            </Button>
            <Input
              type="date"
              value={customDate}
              onChange={(event) => {
                setCustomDate(event.target.value)
                setRangeType("date")
              }}
              className="h-9 w-[140px]"
            />
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customRangeStart}
                onChange={(event) => {
                  setCustomRangeStart(event.target.value)
                  setRangeType("range")
                }}
                className="h-9 w-[140px]"
              />
              <Input
                type="date"
                value={customRangeEnd}
                onChange={(event) => {
                  setCustomRangeEnd(event.target.value)
                  setRangeType("range")
                }}
                className="h-9 w-[140px]"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (rangeType === "week") {
                  setCurrentDate(addWeeks(currentDate, 1))
                } else if (rangeType === "today") {
                  setCurrentDate(addDays(currentDate, 1))
                } else if (rangeType === "date") {
                  const next = addDays(new Date(customDate), 1)
                  setCustomDate(format(next, "yyyy-MM-dd"))
                } else if (rangeType === "range") {
                  if (customRangeStart) {
                    const nextStart = addDays(new Date(customRangeStart), 1)
                    setCustomRangeStart(format(nextStart, "yyyy-MM-dd"))
                  }
                  if (customRangeEnd) {
                    const nextEnd = addDays(new Date(customRangeEnd), 1)
                    setCustomRangeEnd(format(nextEnd, "yyyy-MM-dd"))
                  }
                } else {
                  setCurrentDate(addMonths(currentDate, 1))
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {calendarDays.map((day) => {
                const dayEvents = getEventsForDay(day)
                const dayKey = format(day, "yyyy-MM-dd")
                const timeOffSummary = getTimeOffSummary(dayKey)
                const holidaySummary = getHolidaySummary(dayKey)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isTodayDate = isToday(day)
                if (rangeType === "month" && !isCurrentMonth) return null
                if ((rangeType === "week" || rangeType === "month") && dayEvents.length === 0) return null

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "rounded-lg border p-3 cursor-pointer",
                      isTodayDate ? "border-primary bg-primary/5" : "border-border"
                    )}
                    onClick={() => {
                      setSelectedDay(day)
                      setDayDialogOpen(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium flex items-center gap-2">
                        {format(day, "EEE, MMM d")}
                        <div className="flex items-center gap-1">
                          {timeOffSummary && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                                  <UserMinus className="h-3 w-3" />
                                  {timeOffSummary.count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[240px] text-xs">
                                <div className="font-medium">Employees off</div>
                                <div className="mt-1 text-muted-foreground">{timeOffSummary.details}</div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {holidaySummary && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">
                                  <Flag className="h-3 w-3" />
                                  {holidaySummary.count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[240px] text-xs">
                                <div className="font-medium">UK public holiday</div>
                                <div className="mt-1 text-muted-foreground">{holidaySummary.details}</div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dayEvents.length} job{dayEvents.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    {dayEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground mt-2">No jobs scheduled</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between gap-2 text-xs p-2 rounded border"
                            style={{
                              backgroundColor: `${event.color}15`,
                              borderColor: `${event.color}30`,
                              color: event.color,
                            }}
                          >
                            <span className="truncate">
                              {format(new Date(event.start), "HH:mm")} {event.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {event.extendedProps.assignee?.name ?? "Unassigned"}
                            </span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="hidden md:grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dayEvents = getEventsForDay(day)
                const dayKey = format(day, "yyyy-MM-dd")
                const timeOffSummary = getTimeOffSummary(dayKey)
                const holidaySummary = getHolidaySummary(dayKey)
                const isCurrentMonth = isSameMonth(day, currentDate)
                const isTodayDate = isToday(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-24 p-2 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                      isTodayDate ? "border-primary bg-primary/5" : "border-border",
                      rangeType === "month" && !isCurrentMonth && "opacity-50"
                    )}
                    onClick={() => {
                      setSelectedDay(day)
                      setDayDialogOpen(true)
                    }}
                  >
                    <div className={cn("flex items-center justify-between gap-1 text-sm font-medium mb-1", isTodayDate && "text-primary")}>
                      <span>{format(day, "d")}</span>
                      <div className="flex items-center gap-1">
                        {timeOffSummary && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] text-blue-700">
                                <UserMinus className="h-3 w-3" />
                                {timeOffSummary.count}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-xs">
                              <div className="font-medium">Employees off</div>
                              <div className="mt-1 text-muted-foreground">{timeOffSummary.details}</div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {holidaySummary && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
                                <Flag className="h-3 w-3" />
                                {holidaySummary.count}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[240px] text-xs">
                              <div className="font-medium">UK public holiday</div>
                              <div className="mt-1 text-muted-foreground">{holidaySummary.details}</div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded truncate border"
                          style={{ 
                            backgroundColor: `${event.color}20`, 
                            borderColor: `${event.color}40`,
                            color: event.color 
                          }}
                        >
                          {format(new Date(event.start), "HH:mm")} {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-xl sm:max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>
                  {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy") : "Day details"}
                </DialogTitle>
                <DialogDescription>
                  {viewMode === "timeline" 
                    ? "Click on a time slot to reschedule a job. Drag jobs to change their time."
                    : "Jobs scheduled for this day and assigned cleaners."}
                </DialogDescription>
              </div>
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "timeline" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("timeline")}
                  className="h-7 px-2"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Timeline
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-7 px-2"
                >
                  List
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {selectedDayEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No jobs scheduled for this day.</div>
          ) : viewMode === "timeline" ? (
            /* Timeline View with Drag & Drop */
            <div className="flex-1 overflow-y-auto pr-3 sm:pr-4">
              <div className="relative">
                {selectedHourStart && selectedHourEnd && (
                  <div className="mb-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        Jobs overlapping {format(selectedHourStart, "HH:mm")}–{format(selectedHourEnd, "HH:mm")}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedHour(null)}>
                        Clear
                      </Button>
                    </div>
                    {overlappingHourJobs.length === 0 ? (
                      <div className="mt-2 text-xs text-muted-foreground">No jobs in this hour.</div>
                    ) : (
                      <div className="mt-2 grid gap-2">
                        {overlappingHourJobs.map((event) => (
                          <div
                            key={`hour-${event.id}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/jobs/${event.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                router.push(`/jobs/${event.id}`)
                              }
                            }}
                            className="rounded border bg-background/70 p-2 text-xs cursor-pointer transition-colors hover:bg-accent/50"
                          >
                            <div className="font-medium">{event.title}</div>
                            <div className="text-muted-foreground">
                              {format(new Date(event.start), "HH:mm")}–{format(new Date(event.end), "HH:mm")}
                            </div>
                            <div className="text-muted-foreground">
                              Cleaner: {event.extendedProps.assignee?.name ?? "Unassigned"}
                            </div>
                            <div className="text-muted-foreground">
                              Customer: {event.extendedProps.customer?.name ?? "Unknown"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Instructions */}
                {rescheduling && (
                  <div className="absolute top-0 left-0 right-0 bg-blue-100 border-b border-blue-300 p-2 z-10 text-center">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Rescheduling job...
                  </div>
                )}
                
                {/* Time slots grid */}
                <div className="flex">
                  {/* Time labels */}
                  <div className="w-16 flex-shrink-0">
                    {timeSlots.filter(s => s.minute === 0).map((slot) => (
                      <div
                        key={slot.label}
                        className={cn(
                          "h-[72px] text-xs text-muted-foreground border-t flex items-start pt-1 cursor-pointer hover:text-foreground",
                          selectedHour === slot.hour && "text-foreground font-medium bg-primary/10 border-primary/60"
                        )}
                        onClick={() => setSelectedHour(slot.hour)}
                      >
                        {slot.label}
                      </div>
                    ))}
                  </div>
                  
                  {/* Timeline area with drop zones */}
                  <div className="flex-1 relative border-l">
                    {/* Drop zones for each 30-min slot */}
                    {timeSlots.map((slot) => {
                      const isDropTarget = dropTargetSlot?.hour === slot.hour && dropTargetSlot?.minute === slot.minute
                      const isSelectedHourRow = selectedHour !== null && slot.hour === selectedHour
                      return (
                        <div
                          key={`drop-${slot.hour}-${slot.minute}`}
                          className={cn(
                            "h-9 border-t border-dashed transition-colors",
                            slot.minute === 0 ? "border-muted" : "border-muted/50",
                            isDropTarget && "bg-blue-200/50 border-blue-400",
                            isSelectedHourRow && !isDropTarget && "bg-primary/10 border-primary/60",
                            draggingJobId && "hover:bg-blue-100/50"
                          )}
                          onDragOver={(e) => handleDragOver(e, slot.hour, slot.minute)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, slot.hour, slot.minute)}
                        >
                          {isDropTarget && (
                            <div className="text-xs text-blue-600 font-medium pl-2 pt-1">
                              Drop here: {slot.label}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    
                    {/* Jobs positioned on timeline */}
                    <div className="absolute inset-0 top-0 left-0 pointer-events-none">
                      {selectedDayEvents.map((event) => {
                        const eventStart = new Date(event.start)
                        const eventEnd = new Date(event.end)
                        const startHour = eventStart.getHours()
                        const startMinute = eventStart.getMinutes()
                        
                        // Calculate position (00:00 = 0, each 30min = 36px)
                        const topOffset = (startHour * 72) + (startMinute / 60 * 72)
                        const duration = differenceInMinutes(eventEnd, eventStart)
                        const height = Math.max((duration / 60) * 72, 36)
                        
                        // Skip if outside 24-hour range (shouldn't happen)
                        if (startHour < 0 || startHour > 23) return null

                        const statusKey = normalizeStatus(event.status)
                        const isCompleted = statusKey === "completed"
                        const isDragging = draggingJobId === event.id
                        const cleanerName = event.extendedProps.assignee?.name ?? "Unassigned"
                        const customerName = event.extendedProps.customer?.name ?? "Unknown Customer"
                        const address = formatAddress(
                          event.extendedProps.location,
                          event.extendedProps.city,
                          event.extendedProps.postcode
                        )

                        return (
                          <div
                            key={event.id}
                            draggable={!isCompleted}
                            onDragStart={(e) => handleDragStart(e, event.id, event.status)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "absolute left-1 right-1 rounded-md border px-2 py-1 transition-all group pointer-events-auto relative",
                              !isCompleted && "cursor-grab active:cursor-grabbing hover:shadow-md",
                              isCompleted && "cursor-not-allowed opacity-75",
                              getStatusCardClass(event.status),
                              isDragging && "opacity-50 shadow-lg ring-2 ring-blue-500"
                            )}
                            style={{ top: `${topOffset}px`, height: `${height}px` }}
                          >
                            <div
                              className={cn(
                                "absolute top-1 right-16 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize pointer-events-none",
                                getStatusBadgeClass(event.status)
                              )}
                            >
                              {formatStatusLabel(event.status)}
                            </div>
                            <div className="flex items-start justify-between gap-1 h-full">
                              <div className="min-w-0 flex-1 overflow-hidden pr-16">
                                <div className="font-medium text-sm truncate flex items-center gap-1">
                                  {!isCompleted && <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                  {event.title}
                                </div>
                                <div className="text-xs text-muted-foreground truncate leading-tight">
                                  {format(eventStart, "HH:mm")} - {format(eventEnd, "HH:mm")} â€¢ {cleanerName}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate leading-tight">
                                  Customer: {customerName}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate leading-tight">
                                  Cleaner: {cleanerName}
                                </div>
                                {address && (
                                  <div className="text-[11px] text-muted-foreground truncate leading-tight">
                                    {address}
                                  </div>
                                )}
                              </div>
                              <div
                                className="flex items-center gap-1 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-100"
                                  onClick={() => handleEditJob(event.id)}
                                  disabled={loadingJobEdit}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <div className="opacity-100">
                                  <JobCornerActions
                                    jobId={event.id}
                                    title={event.title}
                                    status={event.status}
                                    onRefresh={() => fetchCalendarData(true)}
                                    align="end"
                                  />
                                </div>
                              </div>
                            </div>
                            {isCompleted && (
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1 rounded">
                                ✓
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Drag instructions */}
                <div className="mt-4 border-t pt-3 text-center text-sm text-muted-foreground">
                  <GripVertical className="h-4 w-4 inline mr-1" />
                  Drag jobs to reschedule • Completed jobs cannot be moved
                </div>
              </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {selectedDayEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${
                    event.status === "completed"
                      ? "border-green-300 bg-green-100/90"
                      : event.status === "in-progress"
                        ? "border-yellow-300 bg-yellow-100/90"
                        : event.status === "scheduled"
                          ? "border-blue-300 bg-blue-100/90"
                          : event.status === "pending"
                            ? "border-red-300 bg-red-100/90"
                            : event.status === "rejected"
                              ? "border-gray-500 bg-gray-300/90"
                              : event.status === "cancelled"
                                ? "border-rose-300 bg-rose-100/90"
                                : "border-gray-300 bg-gray-100/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{event.title}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(event.start), "HH:mm")} - {format(new Date(event.end), "HH:mm")}
                      </div>
                      <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditJob(event.id)}
                          disabled={loadingJobEdit}
                        >
                          {loadingJobEdit ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
                        <JobCornerActions
                          jobId={event.id}
                          title={event.title}
                          status={event.status}
                          onRefresh={() => fetchCalendarData(true)}
                          align="end"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <div>
                      Customer: {event.extendedProps.customer?.name ?? "Unassigned"}
                    </div>
                    <div>
                      Cleaner: {event.extendedProps.assignee?.name ?? "Unassigned"}
                    </div>
                    <div className="capitalize">Status: {event.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

    <EditJobDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      job={selectedJobForEdit}
      onSuccess={handleEditSuccess}
    />
    </Card>
  )
}
