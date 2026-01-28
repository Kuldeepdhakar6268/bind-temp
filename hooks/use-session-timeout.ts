"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"

interface SessionTimeoutOptions {
  /** Timeout in milliseconds (default: 30 minutes) */
  timeout?: number
  /** Path to redirect to on timeout */
  logoutPath: string
  /** Storage keys to clear on logout */
  storageKeys?: string[]
  /** Callback before logout */
  onLogout?: () => void
  /** Whether to show warning before logout (in ms before timeout) */
  warningTime?: number
  /** Callback for warning */
  onWarning?: (remainingTime: number) => void
}

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "keypress",
]

/**
 * Hook to automatically log out users after a period of inactivity
 * 
 * @example
 * ```tsx
 * useSessionTimeout({
 *   timeout: 30 * 60 * 1000, // 30 minutes
 *   logoutPath: "/portal",
 *   storageKeys: ["customer_token", "customer_data"],
 * })
 * ```
 */
export function useSessionTimeout({
  timeout = 30 * 60 * 1000, // 30 minutes default
  logoutPath,
  storageKeys = [],
  onLogout,
  warningTime,
  onWarning,
}: SessionTimeoutOptions) {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current)
      warningRef.current = null
    }
  }, [])

  const handleLogout = useCallback(() => {
    clearTimers()

    // Clear specified storage keys
    storageKeys.forEach((key) => {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    })

    // Call onLogout callback if provided
    onLogout?.()

    // Redirect to logout path
    router.push(logoutPath)
  }, [clearTimers, storageKeys, onLogout, router, logoutPath])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    clearTimers()

    // Set warning timer if configured
    if (warningTime && onWarning) {
      const warningDelay = timeout - warningTime
      if (warningDelay > 0) {
        warningRef.current = setTimeout(() => {
          onWarning(warningTime)
        }, warningDelay)
      }
    }

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, timeout)
  }, [clearTimers, timeout, warningTime, onWarning, handleLogout])

  useEffect(() => {
    // Initial timer setup
    resetTimer()

    // Add activity listeners
    const handleActivity = () => {
      resetTimer()
    }

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Cleanup
    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [resetTimer, clearTimers])

  // Return utility functions
  return {
    resetTimer,
    logout: handleLogout,
    getLastActivity: () => lastActivityRef.current,
    getRemainingTime: () => {
      const elapsed = Date.now() - lastActivityRef.current
      return Math.max(0, timeout - elapsed)
    },
  }
}

/**
 * Hook for customer portal session timeout
 * 30 minute timeout with 5 minute warning
 */
export function useCustomerSessionTimeout() {
  return useSessionTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    logoutPath: "/portal",
    storageKeys: ["customer_token", "customer_data"],
    warningTime: 5 * 60 * 1000, // 5 minute warning
    onWarning: (remainingTime) => {
      const minutes = Math.ceil(remainingTime / 60000)
      console.log(`Session will expire in ${minutes} minutes due to inactivity`)
    },
  })
}

/**
 * Hook for employee app session timeout
 * 60 minute timeout with 10 minute warning
 */
export function useEmployeeSessionTimeout(onWarning?: (minutes: number) => void) {
  return useSessionTimeout({
    timeout: 60 * 60 * 1000, // 60 minutes
    logoutPath: "/login?type=employee",
    storageKeys: ["employee_token", "employee_data"],
    warningTime: 10 * 60 * 1000, // 10 minute warning
    onWarning: (remainingTime) => {
      const minutes = Math.ceil(remainingTime / 60000)
      onWarning?.(minutes)
    },
    onLogout: async () => {
      // Call the logout API to invalidate the server session
      try {
        await fetch("/api/auth/employee-signout", { method: "POST" })
      } catch (error) {
        console.error("Failed to sign out:", error)
      }
    },
  })
}

/**
 * Hook for admin/company dashboard session timeout
 * 30 minute timeout with 5 minute warning
 */
export function useAdminSessionTimeout(onWarning?: (minutes: number) => void) {
  return useSessionTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    logoutPath: "/login",
    storageKeys: [],
    warningTime: 5 * 60 * 1000, // 5 minute warning
    onWarning: (remainingTime) => {
      const minutes = Math.ceil(remainingTime / 60000)
      onWarning?.(minutes)
    },
    onLogout: async () => {
      // Call the logout API to invalidate the server session
      try {
        await fetch("/api/auth/signout", { method: "POST" })
      } catch (error) {
        console.error("Failed to sign out:", error)
      }
    },
  })
}
