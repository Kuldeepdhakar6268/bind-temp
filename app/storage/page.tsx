"use client"

import { useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { StorageList } from "@/components/storage/storage-list"
import { Button } from "@/components/ui/button"
import { Plus, Download } from "lucide-react"

export default function StoragePage() {
  const [addRequestKey, setAddRequestKey] = useState(0)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Storage</h1>
            <p className="text-muted-foreground mt-1">Manage inventory and supplies</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => setAddRequestKey((k) => k + 1)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        <StorageList addRequestKey={addRequestKey} />
      </main>
    </div>
  )
}
