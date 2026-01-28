"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Plus, RefreshCw, Edit2, Trash2, Loader2, ExternalLink } from "lucide-react"
import { getStatusTheme } from "@/lib/utils"
import { CreateJobDialog } from "@/components/scheduling/create-job-dialog"
import { useToast } from "@/hooks/use-toast"

export type TaskTableItem = {
  id: number
  client: string
  location?: string | null
  staff?: string | null
  scheduledFor?: Date | string | null
  status?: string | null
}

type TasksTableProps = {
  tasks?: TaskTableItem[]
  onRefresh?: () => void
}

export function TasksTable({ tasks: initialTasks = [], onRefresh }: TasksTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [tasks, setTasks] = useState<TaskTableItem[]>(initialTasks)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/jobs?filter=today")
      if (res.ok) {
        const jobs = await res.json()
        const mappedTasks: TaskTableItem[] = jobs.map((job: any) => ({
          id: job.id,
          client:
            job.customer?.name ||
            `${job.customer?.firstName || ""} ${job.customer?.lastName || ""}`.trim() ||
            "Unknown",
          location: job.location,
          staff: job.assignee ? `${job.assignee.firstName} ${job.assignee.lastName}` : "Unassigned",
          scheduledFor: job.scheduledFor,
          status: job.status,
        }))
        setTasks(mappedTasks)
      }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      toast({ title: "Error", description: "Failed to refresh tasks", variant: "destructive" })
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  // Initial fetch and polling
  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 60000) // Refresh every 60 seconds
    return () => clearInterval(interval)
  }, [fetchTasks])

  // Update tasks when initialTasks change
  useEffect(() => {
    if (initialTasks.length > 0) {
      setTasks(initialTasks)
    }
  }, [initialTasks])

  const handleRefresh = () => {
    fetchTasks()
    if (onRefresh) onRefresh()
  }

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false)
    fetchTasks()
    toast({ title: "Success", description: "Job created successfully!" })
  }

  const handleRowClick = (taskId: number) => {
    router.push(`/jobs/${taskId}`)
  }

  const handleEditClick = (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    router.push(`/jobs/${taskId}/edit`)
  }

  const handleViewClick = (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    router.push(`/jobs/${taskId}`)
  }

  const filteredTasks = useMemo(() => {
    const searchTerm = search.toLowerCase()
    return tasks.filter((task) => {
      const matchesFilter = filter === "all" || (task.status ?? "").toLowerCase() === filter
      const matchesSearch =
        (task.client ?? "").toLowerCase().includes(searchTerm) ||
        (task.location ?? "").toLowerCase().includes(searchTerm) ||
        (task.staff ?? "").toLowerCase().includes(searchTerm)
      return matchesFilter && matchesSearch
    })
  }, [filter, search, tasks])

  const formatDate = (value?: Date | string | null) => {
    if (!value) return "—"
    const date = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date)
  }

  const formatTime = (value?: Date | string | null) => {
    if (!value) return "—"
    const date = typeof value === "string" ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Today&apos;s Tasks</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Task</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refreshing && tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No tasks found for today
                      <Button 
                        variant="link" 
                        className="block mx-auto mt-2"
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        Schedule a new job
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => (
                    <TableRow 
                      key={task.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(task.id)}
                    >
                      <TableCell className="font-medium">{task.client}</TableCell>
                      <TableCell>{task.location}</TableCell>
                      <TableCell>{task.staff}</TableCell>
                      <TableCell>{formatDate(task.scheduledFor)}</TableCell>
                      <TableCell>{formatTime(task.scheduledFor)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusTheme(task.status ?? "pending").badgeClass}>
                          {getStatusTheme(task.status ?? "pending").label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => handleViewClick(e, task.id)}
                            title="View job"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={(e) => handleEditClick(e, task.id)}
                            title="Edit job"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateJobDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          fetchTasks()
          toast({ title: "Success", description: "Job created successfully!" })
        }}
      />
    </>
  )
}
