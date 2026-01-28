import { getSession } from "@/lib/auth"
import { DashboardHeader } from "./dashboard-header"

export async function DashboardHeaderWrapper() {
  const session = await getSession()

  return <DashboardHeader session={session} />
}

