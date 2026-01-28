"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useFeatures } from "@/components/features-provider"
import {
  Calendar,
  Home,
  User,
  Briefcase,
  LogOut,
  ChevronDown,
  TrendingUp,
  CalendarOff,
  PlayCircle,
  Settings,
  Menu,
  X,
  Package,
  Wallet,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function EmployeeSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = React.useState<any>(null)
  const [companyName, setCompanyName] = React.useState<string>("")
  const [supplyUpdatesCount, setSupplyUpdatesCount] = React.useState<number>(0)
  const [pendingAcceptanceCount, setPendingAcceptanceCount] = React.useState<number>(0)
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  React.useEffect(() => {
    // Fetch employee session
    fetch("/api/auth/employee-session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data)
        setCompanyName(data.companyName || "")
      })
      .catch(() => setUser(null))

    const fetchCounts = async () => {
      try {
        const [supplyRes, jobsRes] = await Promise.all([
          fetch("/api/employee/supply-requests"),
          fetch("/api/employee/jobs"),
        ])
        const [supplyData, jobsData] = await Promise.all([
          supplyRes.json(),
          jobsRes.json(),
        ])
        const requests = Array.isArray(supplyData?.requests) ? supplyData.requests : []
        const updates = requests.filter((req: any) => req.status !== "pending").length
        setSupplyUpdatesCount(updates)

        const jobs = Array.isArray(jobsData) ? jobsData : []
        const pending = jobs.filter(
          (job: any) => job.status === "scheduled" && !job.employeeAccepted
        ).length
        setPendingAcceptanceCount(pending)
      } catch {
        setSupplyUpdatesCount(0)
        setPendingAcceptanceCount(0)
      }
    }

    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(fetchCounts, 2000)
    }

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        fetchCounts()
        startPolling()
      }
    }

    fetchCounts()
    startPolling()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  // Get features context for filtering
  const { filterItems } = useFeatures()

  // Daily Work section - Most used, primary workflow
  const dailyWorkItems = filterItems([
    {
      title: "Dashboard",
      url: "/employee",
      icon: Home,
      badge: pendingAcceptanceCount > 0 ? pendingAcceptanceCount : null,
      description: "Overview",
    },
  ])

  // Planning section - Regular use
  const planningItems = filterItems([
    {
      title: "Time Off",
      url: "/employee/time-off",
      icon: CalendarOff,
      badge: null,
      description: "Request leave",
    },
    {
      title: "Supply Requests",
      url: "/employee/supply-requests",
      icon: Package,
      badge: supplyUpdatesCount > 0 ? supplyUpdatesCount : null,
      description: "Request supplies",
    },
  ])

  // Account section - Less frequent
  const accountItems = filterItems([
    {
      title: "My Finances",
      url: "/employee/finances",
      icon: Wallet,
      badge: null,
      description: "Earnings",
    },
    {
      title: "Performance",
      url: "/employee/performance",
      icon: TrendingUp,
      badge: null,
      description: "Your stats",
    },
    {
      title: "Profile",
      url: "/employee/profile",
      icon: User,
      badge: null,
      description: "Settings",
    },
  ])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/employee-signout", { method: "POST" })
    } catch (error) {
      console.error("Logout error:", error)
    }
    
    // Clear any client-side storage
    if (typeof window !== "undefined") {
      localStorage.removeItem("employee_token")
      localStorage.removeItem("employee_data")
      sessionStorage.clear()
    }
    
    // Force a hard redirect to clear any cached state
    window.location.href = "/login"
  }

  const userInitials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "U"
  const displayName = user ? `${user.firstName} ${user.lastName}` : "Employee"
  const roleLabel = user?.role || "Employee"

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{companyName || "CleanManager"}</span>
              <span className="text-xs text-muted-foreground">Employee Portal</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          {/* Daily Work - Primary Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Daily Work
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dailyWorkItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} className="h-10">
                        <Link href={item.url} className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </span>
                          {item.badge !== null && (
                            <Badge 
                              variant={item.badgeVariant || "secondary"} 
                              className="ml-auto h-5 min-w-5 px-1.5 text-xs"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Planning Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Planning
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {planningItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} className="h-10">
                        <Link href={item.url} className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </span>
                          {item.badge !== null && (
                            <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Account Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {accountItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} className="h-10">
                        <Link href={item.url} className="flex items-center justify-between w-full">
                          <span className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </span>
                          {item.badge !== null && (
                            <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium">
                    {user ? `${user.firstName} ${user.lastName}` : "Loading..."}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user?.role || "Employee"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile Slide-out Menu */}
      <div className={`
        fixed top-0 left-0 h-full w-72 bg-background border-r z-50 transform transition-transform duration-300 ease-in-out md:hidden
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between border-b px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{companyName || "CleanManager"}</span>
              <span className="text-xs text-muted-foreground">Employee Portal</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-3 py-4 space-y-6">
            {/* Daily Work Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Daily Work
              </h3>
              <div className="space-y-1">
                {dailyWorkItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </span>
                      {item.badge !== null && (
                        <Badge 
                          variant={isActive ? "secondary" : (item.badgeVariant || "secondary")}
                          className="h-5 min-w-5 px-1.5 text-xs"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Planning Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Planning
              </h3>
              <div className="space-y-1">
                {planningItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </span>
                      {item.badge !== null && (
                        <Badge
                          variant={isActive ? "secondary" : "secondary"}
                          className="h-5 min-w-5 px-1.5 text-xs"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Account Section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Account
              </h3>
              <div className="space-y-1">
                {accountItems.map((item) => {
                  const isActive = pathname === item.url
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{item.title}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        {/* Mobile Menu Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t p-4 bg-background">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{roleLabel}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Fixed Header - Always visible */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-background border-b shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {/* Mobile Hamburger Menu */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <main className="flex-1 overflow-auto">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b bg-background sticky top-0 z-10">
          {/* Spacer for desktop */}
          <div />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3">
                <div className="flex flex-col items-end leading-tight">
                  <span className="text-sm font-medium">{displayName}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground capitalize">{roleLabel}</span>
                    {companyName && (
                      <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                        {companyName}
                      </span>
                    )}
                  </div>
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Mobile spacer for fixed header */}
        <div className="h-[57px] md:hidden" />
        
        {children}
      </main>
    </SidebarProvider>
  )
}
