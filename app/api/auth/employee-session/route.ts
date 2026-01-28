import { NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json(null, { status: 200 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error("Employee session error:", error)
    return NextResponse.json(null, { status: 500 })
  }
}


