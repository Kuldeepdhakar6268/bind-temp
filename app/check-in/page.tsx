"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { CheckInList } from "@/components/check-in/check-in-list"
import { CheckInMap } from "@/components/check-in/check-in-map"
import { Button } from "@/components/ui/button"
import { Filter, Download } from "lucide-react"

export default function CheckInPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Check-in</h1>
            <p className="text-muted-foreground mt-1">Track staff attendance and job check-ins</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CheckInList />
          </div>
          <div>
            <CheckInMap />
          </div>
        </div>
      </main>
    </div>
  )
}
