"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAdminSessionTimeout } from "@/hooks/use-session-timeout"
import { toast } from "sonner"

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

interface AuthContextType {
  user: SessionUser | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} })

export function useAuth() {
  return useContext(AuthContext)
}

// Routes that don't require authentication and shouldn't trigger session timeout
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/portal", "/quote", "/job", "/feedback"]

function SessionTimeoutWrapper({ children, user }: { children: React.ReactNode; user: SessionUser | null }) {
  const pathname = usePathname()
  
  // Only apply session timeout for authenticated users on protected routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isEmployeeRoute = pathname.startsWith("/employee")
  const shouldApplyTimeout = user && !isPublicRoute && !isEmployeeRoute
  
  // Session timeout with warning
  useAdminSessionTimeout(
    shouldApplyTimeout 
      ? (minutes) => {
          toast.warning(`Your session will expire in ${minutes} minute${minutes > 1 ? 's' : ''} due to inactivity`, {
            id: "session-warning",
            duration: 10000,
          })
        }
      : undefined
  )
  
  return <>{children}</>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchSession()
  }, [])

  const fetchSession = async () => {
    try {
      const response = await fetch("/api/auth/session")
      if (response.ok) {
        const data = await response.json().catch(() => null)
        setUser(data?.user ?? null)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to fetch session:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" })
      setUser(null)
    } catch (error) {
      console.error("Failed to logout:", error)
    }
    
    // Clear any client-side storage
    if (typeof window !== "undefined") {
      sessionStorage.clear()
    }
    
    // Force a hard redirect to clear any cached state
    window.location.href = "/login"
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      <SessionTimeoutWrapper user={user}>
        {children}
      </SessionTimeoutWrapper>
    </AuthContext.Provider>
  )
}

