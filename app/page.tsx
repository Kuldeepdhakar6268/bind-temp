export const dynamic = "force-dynamic"

import type { Viewport } from "next"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { OverviewDashboard } from "@/components/overview-dashboard"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />
      <OverviewDashboard />
    </div>
  )
}
