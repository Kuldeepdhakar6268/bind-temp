import { DashboardHeaderWrapper } from "@/components/dashboard-header-wrapper"
import { ProfileTabs } from "@/components/profile/profile-tabs"

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderWrapper />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Company Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your company and account settings</p>
        </div>

        <ProfileTabs />
      </main>
    </div>
  )
}

