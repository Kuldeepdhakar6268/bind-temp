"use client"

import { ReactNode, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useEmployeeSessionTimeout } from "@/hooks/use-session-timeout"
import { toast } from "sonner"

interface EmployeeLayoutProps {
  children: ReactNode
}

export function EmployeeSessionProvider({ children }: EmployeeLayoutProps) {
  const router = useRouter()
  const [warningShown, setWarningShown] = useState(false)

  // Session timeout - auto logout after 60 minutes of inactivity
  useEmployeeSessionTimeout((minutes) => {
    if (!warningShown) {
      setWarningShown(true)
      toast.warning(`Session expires in ${minutes} minutes`, {
        description: "Move your mouse or tap the screen to stay logged in.",
        duration: 30000,
      })
      // Reset warning state after it's dismissed
      setTimeout(() => setWarningShown(false), 30000)
    }
  })

  return <>{children}</>
}
