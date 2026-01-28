import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { CleaningPlansList } from "@/components/cleaning-plans/cleaning-plans-list"

export default function CleaningPlansPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cleaning Plans</h1>
          <p className="text-muted-foreground mt-1">Manage standardized cleaning procedures</p>
        </div>

        <CleaningPlansList />
      </main>
    </div>
  )
}
