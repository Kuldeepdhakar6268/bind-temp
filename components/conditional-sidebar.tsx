"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { EmployeeSidebar } from "@/components/employee-sidebar"
import { FeaturesProvider } from "@/components/features-provider"

// Routes that should NOT show any sidebar (public/auth pages)
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/portal", "/admin"]

export function ConditionalSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [hasEmployeeSession, setHasEmployeeSession] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isEmployeeRoute = pathname === "/employee" || pathname.startsWith("/employee/")

    async function loadSessions() {
      try {
        // Fetch company session (admins/managers)
        const sessionRes = await fetch("/api/auth/session")
        const sessionData = await sessionRes.json()
        setUserRole(sessionData?.role || null)
      } catch {
        setUserRole(null)
      }

      if (isEmployeeRoute) {
        try {
          const employeeRes = await fetch("/api/auth/employee-session")
          const employeeData = await employeeRes.json()
          setHasEmployeeSession(!!employeeData)
        } catch {
          setHasEmployeeSession(false)
        }
      } else {
        setHasEmployeeSession(false)
      }

      setLoading(false)
    }

    loadSessions()
  }, [pathname])

  // Check if current path is an auth route (no sidebar needed)
  const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route))

  if (isAuthRoute) {
    // Don't show sidebar on auth pages
    return <>{children}</>
  }

  // Show loading state while checking role
  if (loading) {
    return <>{children}</>
  }

  const isEmployeeRoute = pathname === "/employee" || pathname.startsWith("/employee/")
  // Always use employee sidebar for /employee routes (strict separation)
  if (isEmployeeRoute) {
    return (
      <FeaturesProvider apiEndpoint="/api/employee/features">
        <EmployeeSidebar>{children}</EmployeeSidebar>
      </FeaturesProvider>
    )
  }

  // Show admin/manager sidebar for other roles
  return (
    <FeaturesProvider apiEndpoint="/api/features">
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex-1">{children}</div>
      </div>
    </FeaturesProvider>
  )
}

