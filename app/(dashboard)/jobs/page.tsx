"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { JobsList } from "@/components/jobs/jobs-list"
import { JobCalendar } from "@/components/jobs/job-calendar"
import { JobAnalytics } from "@/components/jobs/job-analytics"
import { JobsProvider, useJobs } from "@/lib/jobs-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, List, CalendarDays, BarChart3, RefreshCw, Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"

function JobsPageContent() {
  const router = useRouter()
  const {
    stats,
    notifications,
    unreadCount,
    lastRefresh,
    refreshJobs,
    markNotificationRead,
    clearNotifications,
    loading,
  } = useJobs()

  const [activeTab, setActiveTab] = useState("list")
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
    refreshJobs()
  }, [refreshJobs])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs & Scheduling</h1>
          <p className="text-muted-foreground">
            Manage and schedule cleaning jobs for your customers.
            {lastRefresh && (
              <span className="ml-2 text-xs">
                Last updated: {format(lastRefresh, "HH:mm:ss")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats badges */}
          <div className="hidden md:flex items-center gap-2 mr-4">
            <Badge variant="outline" className="bg-blue-50">
              {stats.scheduled} Scheduled
            </Badge>
            <Badge variant="outline" className="bg-amber-50">
              {stats.inProgress} In Progress
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              {stats.completed} Completed
            </Badge>
          </div>

          {/* Notifications dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={clearNotifications}
                  >
                    Clear all
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`flex flex-col items-start gap-1 ${
                      !notification.read ? "bg-blue-50" : ""
                    }`}
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <div className="font-medium">{notification.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {notification.message}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(notification.timestamp, "MMM d, HH:mm")}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh button */}
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* Add Job button */}
          <Button onClick={() => router.push("/scheduling?new=true")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            List View
            {stats.total > 0 && (
              <Badge variant="secondary" className="ml-1">
                {stats.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <JobsList key={refreshKey} hideAddButton />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <JobCalendar key={`calendar-${refreshKey}`} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <JobAnalytics key={`analytics-${refreshKey}`} />
        </TabsContent>
      </Tabs>

    </div>
  )
}

export default function JobsPage() {
  return (
    <JobsProvider>
      <JobsPageContent />
    </JobsProvider>
  )
}

