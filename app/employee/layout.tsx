import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getEmployeeSession } from "@/lib/auth"
import { EmployeeSessionProvider } from "@/components/employee/session-provider"

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await getEmployeeSession()
  if (!session) {
    redirect("/login?type=employee")
  }

  return <EmployeeSessionProvider>{children}</EmployeeSessionProvider>
}
