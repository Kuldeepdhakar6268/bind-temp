"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { MessagesList } from "@/components/messages/messages-list"
import { MessageComposer } from "@/components/messages/message-composer"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useState } from "react"

export default function MessagesPage() {
  const [showComposer, setShowComposer] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
            <p className="text-muted-foreground mt-1">Communicate with your team</p>
          </div>
          <Button size="sm" onClick={() => setShowComposer(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        <MessagesList />

        <MessageComposer open={showComposer} onOpenChange={setShowComposer} />
      </main>
    </div>
  )
}
