"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFeatures } from "@/components/features-provider"
import {
  LayoutGrid,
  Calendar,
  ArrowDownUp,
  Users,
  UsersRound,
  ClipboardList,
  FileText,
  Building2,
  MessageSquare,
  Clock,
  Wallet,
  FileCheck,
  Package,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MapPin,
  Star,
  Trophy,
  CalendarClock,
  FileSignature,
  Map,
  Wrench,
  Receipt,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react"

// Grouped navigation sections for better organization
const navigationSections = [
  {
    title: "Operations",
    items: [
      { title: "Overview", href: "/", icon: LayoutGrid },
      { title: "Scheduling", href: "/scheduling", icon: Calendar },
      { title: "Verification Center", href: "/verification-center", icon: ShieldCheck },
      { title: "Route Optimizer", href: "/routes", icon: MapPin },
      { title: "Check-in", href: "/check-in", icon: ArrowDownUp },
    ],
  },
  {
    title: "Customers",
    items: [
      { title: "Customers", href: "/customers", icon: Users },
      { title: "Booking Requests", href: "/booking-requests", icon: CalendarClock },
      { title: "Quotes", href: "/quotes", icon: FileSignature },
      { title: "Contracts", href: "/contracts", icon: FileText },
      { title: "Customer Feedback", href: "/feedback", icon: Star },
    ],
  },
  {
    title: "Team",
    items: [
      { title: "Employees", href: "/employees", icon: UsersRound },
      { title: "Teams", href: "/teams", icon: Users },
      { title: "Shift Management", href: "/shifts", icon: CalendarClock },
      { title: "Time-off Requests", href: "/time-off", icon: Clock },
      { title: "Supply Requests", href: "/supply-requests", icon: Package },
      { title: "Work Hours", href: "/work-hours", icon: Clock },
      { title: "Send Message", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Invoicing", href: "/invoicing", icon: FileCheck },
      { title: "Payments", href: "/payments", icon: CreditCard },
      { title: "Expenses", href: "/expenses", icon: Receipt },
      { title: "Profitability", href: "/profitability", icon: TrendingUp },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Service Areas", href: "/service-areas", icon: Map },
      { title: "Cleaning Plans", href: "/cleaning-plans", icon: ClipboardList },
      { title: "Equipment", href: "/equipment", icon: Wrench },
      { title: "Storage", href: "/storage", icon: Package },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingSupplyCount, setPendingSupplyCount] = useState(0)
  const [hasSession, setHasSession] = useState(false)

  const fetchSupplyCounts = async () => {
    try {
      if (!hasSession) return
      const res = await fetch("/api/supply-requests?status=pending")
      if (res.status === 401) {
        setHasSession(false)
        return
      }
      if (!res.ok) return
      const data = await res.json()
      const count = typeof data?.summary?.pending === "number"
        ? data.summary.pending
        : Array.isArray(data?.requests)
          ? data.requests.length
          : 0
      setPendingSupplyCount(count)
    } catch {
      setPendingSupplyCount(0)
    }
  }

  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval || !hasSession) return
      interval = setInterval(fetchSupplyCounts, 2000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session")
        const ok = res.ok
        setHasSession(ok)
        return ok
      } catch {
        setHasSession(false)
        return false
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        checkSession().then((ok) => {
          if (ok) {
            fetchSupplyCounts()
            startPolling()
          }
        })
      }
    }

    checkSession().then((ok) => {
      if (ok) {
        fetchSupplyCounts()
        startPolling()
      }
    })
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [hasSession])

  // Get features context for filtering
  const { filterSections, loading: featuresLoading } = useFeatures()
  
  // Filter navigation sections based on enabled features
  const filteredSections = React.useMemo(() => {
    return filterSections(navigationSections)
  }, [filterSections])

  const SidebarContent = () => (
    <>
      {filteredSections.map((section) => (
        <div key={section.title} className="mb-4">
          {!collapsed && (
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.title}
            </h3>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const badgeValue =
                item.title === "Supply Requests" && pendingSupplyCount > 0
                  ? pendingSupplyCount
                  : null

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                      collapsed && "justify-center px-2",
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {!collapsed && badgeValue !== null && (
                      <span className="ml-auto min-w-5 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground text-center">
                        {badgeValue}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )

  return (
    <>
      {/* Mobile Menu Button - Fixed at top */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-[60] md:hidden h-10 w-10 bg-background shadow-md border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ScrollArea className="flex-1 min-h-0 h-full overscroll-contain">
          <nav className="p-3 pt-20">
            <SidebarContent />
          </nav>
        </ScrollArea>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex bg-sidebar border-r border-sidebar-border transition-all duration-300 relative flex-col h-screen sticky top-0",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">CM</span>
              </div>
              <span className="font-semibold text-sidebar-foreground">CleanManager</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 overscroll-contain">
          <nav className="p-2">
            <SidebarContent />
          </nav>
        </ScrollArea>
      </aside>
    </>
  )
}
