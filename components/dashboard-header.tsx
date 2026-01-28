"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Bell, Settings, LogOut, User } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface SessionUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  companyId: number
  company: {
    id: number
    name: string
    email: string
    logo: string | null
    subscriptionPlan: string
    subscriptionStatus: string
    trialEndsAt: Date | null
  }
}

interface DashboardHeaderProps {
  session?: SessionUser | null
}

export function DashboardHeader({ session }: DashboardHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" })
    } catch (error) {
      console.error("Logout error:", error)
    }
    
    // Clear any client-side storage
    if (typeof window !== "undefined") {
      sessionStorage.clear()
    }
    
    // Force a hard redirect to clear any cached state
    window.location.href = "/login"
  }

  const getDaysRemaining = () => {
    if (!session?.company.trialEndsAt) return 0
    const diff = new Date(session.company.trialEndsAt).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const daysRemaining = getDaysRemaining()
  const isTrial = session?.company.subscriptionPlan === "trial"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 pl-14 md:pl-6">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">{session?.company.name || "CleanManager"}</h2>
            <p className="text-xs text-muted-foreground">Cleaning Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTrial && daysRemaining > 0 && (
            <>
              <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 border-chart-3/20 hidden sm:flex">
                Trial: {daysRemaining} days left
              </Badge>
            </>
          )}

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              3
            </span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {session?.firstName && session?.lastName 
                      ? `${session.firstName[0]}${session.lastName[0]}`.toUpperCase()
                      : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {session ? `${session.firstName} ${session.lastName}` : "User"}
                  </span>
                  {session?.company?.name && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                      {session.company.name}
                    </Badge>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
