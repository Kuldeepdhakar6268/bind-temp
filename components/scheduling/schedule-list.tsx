"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, MapPin, User, Edit2, Loader2, Search } from "lucide-react"
import { format } from "date-fns"
import { EditJobDialog } from "@/components/jobs/edit-job-dialog"
import { JobCornerActions } from "@/components/jobs/job-corner-actions"
import { toast } from "sonner"

interface Schedule {
  id: number
  title: string
  location: string | null
  city: string | null
  postcode: string | null
  assignee: { firstName: string; lastName: string } | null
  scheduledFor: string | null
  scheduledEnd: string | null
  status: string
  recurrence: string | null
  customer: { firstName: string; lastName: string } | null
}

const statusColors: Record<string, string> = {
  scheduled: "bg-chart-4 text-white",
  "in-progress": "bg-chart-1 text-white",
  completed: "bg-chart-2 text-white",
  cancelled: "bg-red-500 text-white",
}

const buildLocation = (schedule: Schedule) => {
  const base = schedule.location?.trim() || ""
  const baseLower = base.toLowerCase()
  const parts = []
  if (base) {
    parts.push(base)
  }
  const city = schedule.city?.trim() || ""
  if (city && !baseLower.includes(city.toLowerCase())) {
    parts.push(city)
  }
  const postcode = schedule.postcode?.trim() || ""
  if (postcode && !baseLower.includes(postcode.toLowerCase())) {
    parts.push(postcode)
  }
  return parts.filter(Boolean).join(", ")
}

export function ScheduleList() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [jobDialogOpen, setJobDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any | null>(null)
  const [loadingJob, setLoadingJob] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [rangeFilter, setRangeFilter] = useState<"upcoming" | "all">("upcoming")

  useEffect(() => {
    fetchSchedules()
    const interval = setInterval(fetchSchedules, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(fetchSchedules, 300)
    return () => clearTimeout(timeout)
  }, [search, statusFilter, rangeFilter])

  const fetchSchedules = async () => {
    try {
      setRefreshing(true)
      const params = new URLSearchParams()
      if (rangeFilter == "upcoming") {
        params.set("filter", "upcoming")
      }
      if (statusFilter != "all") {
        params.set("status", statusFilter)
      }
      if (search.trim()) {
        params.set("search", search.trim())
      }
      params.set("sort", "scheduledFor")

      const response = await fetch(`/api/jobs?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setSchedules(data)
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const filteredSchedules = useMemo(() => {
    if (!search.trim()) return schedules
    const term = search.toLowerCase()
    return schedules.filter((schedule) => {
      const customerName = schedule.customer
        ? `${schedule.customer.firstName} ${schedule.customer.lastName}`
        : ""
      const assigneeName = schedule.assignee
        ? `${schedule.assignee.firstName} ${schedule.assignee.lastName}`
        : ""
      const location = buildLocation(schedule)
      return (
        schedule.title.toLowerCase().includes(term) ||
        customerName.toLowerCase().includes(term) ||
        assigneeName.toLowerCase().includes(term) ||
        location.toLowerCase().includes(term)
      )
    })
  }, [schedules, search])

  const openJobDialog = useCallback(async (scheduleId: number) => {
    try {
      setLoadingJob(true)
      const response = await fetch(`/api/jobs/${scheduleId}`)
      if (!response.ok) {
        throw new Error("Failed to load job details")
      }
      const jobData = await response.json()
      setSelectedJob(jobData)
      setJobDialogOpen(true)
    } catch (error) {
      console.error("Failed to load job details:", error)
      toast.error("Unable to load job details right now")
    } finally {
      setLoadingJob(false)
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Schedule List</CardTitle>
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Schedule List</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                className="pl-8 h-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in-progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={rangeFilter === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setRangeFilter("upcoming")}
                className="h-9"
              >
                Upcoming
              </Button>
              <Button
                variant={rangeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setRangeFilter("all")}
                className="h-9"
              >
                All
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSchedules} disabled={refreshing} className="h-9">
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredSchedules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No schedules match your filters. Try adjusting the filters or create a new job.
          </div>
        ) : (
          <>
            <div className="space-y-4 md:hidden">
              {filteredSchedules.map((schedule) => {
                const staffName = schedule.assignee
                  ? `${schedule.assignee.firstName} ${schedule.assignee.lastName}`
                  : "Unassigned"
                const customerName = schedule.customer
                  ? `${schedule.customer.firstName} ${schedule.customer.lastName}`
                  : schedule.title
                const location = buildLocation(schedule)

                return (
                  <div key={schedule.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-muted-foreground">{customerName}</p>
                        <h4 className="text-base font-semibold">{schedule.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[schedule.status] || "bg-gray-500"}>
                          {schedule.status.replace("-", " ")}
                        </Badge>
                        <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                          <JobCornerActions
                            jobId={schedule.id}
                            title={schedule.title}
                            status={schedule.status}
                            onRefresh={fetchSchedules}
                            align="end"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{location || "Location not set"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{staffName}</span>
                      </div>
                      {schedule.scheduledFor && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(schedule.scheduledFor), "MMM d, yyyy")} at{" "}
                            {format(new Date(schedule.scheduledFor), "HH:mm")}
                            {schedule.scheduledEnd && ` - ${format(new Date(schedule.scheduledEnd), "HH:mm")}`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => openJobDialog(schedule.id)}
                        disabled={loadingJob && selectedJob?.id === schedule.id}
                      >
                        View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => openJobDialog(schedule.id)}
                        disabled={loadingJob && selectedJob?.id === schedule.id}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => {
                const staffName = schedule.assignee
                  ? `${schedule.assignee.firstName} ${schedule.assignee.lastName}`
                  : "Unassigned"
                const customerName = schedule.customer
                  ? `${schedule.customer.firstName} ${schedule.customer.lastName}`
                  : "Unknown"
                const location = buildLocation(schedule)

                return (
                  <TableRow key={schedule.id} className="cursor-pointer" onClick={() => openJobDialog(schedule.id)}>
                    <TableCell>
                      <div className="font-medium">{schedule.title}</div>
                      {schedule.recurrence && schedule.recurrence !== "none" && (
                        <Badge variant="outline" className="mt-1 text-xs capitalize">
                          {schedule.recurrence}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{customerName}</TableCell>
                    <TableCell>{location || "Location not set"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {staffName.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span>{staffName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {schedule.scheduledFor ? (
                        <div className="text-sm">
                          <div>{format(new Date(schedule.scheduledFor), "MMM d, yyyy")}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(schedule.scheduledFor), "HH:mm")}
                            {schedule.scheduledEnd && ` - ${format(new Date(schedule.scheduledEnd), "HH:mm")}`}
                          </div>
                        </div>
                      ) : (
                        "Not scheduled"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[schedule.status] || "bg-gray-500"}>
                        {schedule.status.replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            openJobDialog(schedule.id)
                          }}
                          disabled={loadingJob && selectedJob?.id === schedule.id}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            openJobDialog(schedule.id)
                          }}
                          disabled={loadingJob && selectedJob?.id === schedule.id}
                        >
                          View
                        </Button>
                        <div onMouseDown={(event) => event.stopPropagation()}>
                          <JobCornerActions
                            jobId={schedule.id}
                            title={schedule.title}
                            status={schedule.status}
                            onRefresh={fetchSchedules}
                            align="end"
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
          </>
        )}
      </CardContent>
      {selectedJob && (
        <EditJobDialog
          open={jobDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setJobDialogOpen(false)
              setSelectedJob(null)
            }
          }}
          job={selectedJob}
          onSuccess={() => {
            fetchSchedules()
            setJobDialogOpen(false)
            setSelectedJob(null)
          }}
        />
      )}
    </Card>
  )
}
