export const dynamic = "force-dynamic"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { StatsOverview } from "@/components/stats-overview"
import { QuickActions } from "@/components/quick-actions"
import { TasksTable } from "@/components/tasks-table"
import { RecentActivity } from "@/components/recent-activity"
import { getUpcomingJobs } from "@/lib/db/queries"

export default async function OverviewPage() {
  const tasks = await getUpcomingJobs()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">Monitor your cleaning operations at a glance</p>
          </div>
        </div>

        <StatsOverview />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <QuickActions />
            <TasksTable tasks={tasks} />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  )
}
