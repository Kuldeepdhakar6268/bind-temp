"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { CalendarView } from "@/components/scheduling/calendar-view"
import { ScheduleList } from "@/components/scheduling/schedule-list"
import { NeedsReassignment } from "@/components/scheduling/needs-reassignment"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Download } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CreateJobDialog } from "@/components/scheduling/create-job-dialog"
import { JobsProvider } from "@/lib/jobs-context"
import { toast } from "sonner"

function SchedulingPageContent() {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")
  const [exporting, setExporting] = useState(false)
  const searchParams = useSearchParams()
  const newJobParam = searchParams.get("new")

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await fetch("/api/jobs")
      if (!res.ok) {
        throw new Error("Failed to fetch jobs")
      }
      const jobs = await res.json()

      if (!Array.isArray(jobs) || jobs.length === 0) {
        toast.error("No jobs to export")
        return
      }

      const csvEscape = (value: string | number | null | undefined) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`

      const rows = [
        [
          "Job Title",
          "Status",
          "Customer",
          "Assigned To",
          "Scheduled For",
          "Location",
          "Cleaning Plan",
        ],
        ...jobs.map((job: any) => {
          const customerName =
            job.customer?.name ||
            [job.customer?.firstName, job.customer?.lastName].filter(Boolean).join(" ") ||
            "Unknown Customer"
          const assigneeName =
            job.assignee?.name ||
            [job.assignee?.firstName, job.assignee?.lastName].filter(Boolean).join(" ") ||
            "Unassigned"

          return [
            job.title,
            job.status,
            customerName,
            assigneeName,
            job.scheduledFor ? new Date(job.scheduledFor).toLocaleString() : "Not scheduled",
            job.location || "",
            job.planName || "",
          ]
        }),
      ]

      const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      const dateStamp = new Date().toISOString().split("T")[0]
      link.href = url
      link.download = `scheduling-jobs-${dateStamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Export started")
    } catch (error) {
      console.error("Scheduling export error:", error)
      toast.error("Failed to export jobs")
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (newJobParam === "true") {
      setShowCreateDialog(true)
    }
  }, [newJobParam])

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scheduling</h1>
            <p className="text-muted-foreground mt-1">Manage and organize cleaning schedules</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Export"}
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </div>
        </div>

        {/* Jobs needing reassignment - shows at top when there are declined/unassigned jobs */}
        <NeedsReassignment />

        <div className="grid grid-cols-2 gap-2 border-b md:flex md:gap-2">
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            onClick={() => setViewMode("calendar")}
            className="rounded-b-none w-full md:w-auto"
          >
            Calendar View
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            onClick={() => setViewMode("list")}
            className="rounded-b-none w-full md:w-auto"
          >
            List View
          </Button>
        </div>

        {viewMode === "calendar" ? <CalendarView /> : <ScheduleList />}

        <CreateJobDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </main>
    </div>
  )
}

export default function SchedulingPage() {
  return (
    <JobsProvider>
      <Suspense fallback={null}>
        <SchedulingPageContent />
      </Suspense>
    </JobsProvider>
  )
}
