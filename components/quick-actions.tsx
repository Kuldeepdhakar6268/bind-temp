"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Calendar, Users, FileText, MessageSquare, Clock, Wallet } from "lucide-react"

const actions = [
  { title: "New Job", icon: Plus, href: "/scheduling?new=true", color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
  { title: "Schedule", icon: Calendar, href: "/scheduling", color: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
  { title: "Add Staff", icon: Users, href: "/employees", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  { title: "Create Report", icon: FileText, href: "/reports", color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
  { title: "Send Message", icon: MessageSquare, href: "/messages", color: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100" },
  { title: "Log Hours", icon: Clock, href: "/work-hours", color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
  { title: "Invoice", icon: Wallet, href: "/invoicing", color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.title}
                variant="outline"
                className={`h-auto py-4 flex flex-col gap-2 ${action.color}`}
                asChild
              >
                <a href={action.href}>
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{action.title}</span>
                </a>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
