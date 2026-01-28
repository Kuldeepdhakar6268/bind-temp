import { NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({
      subscriptionPlan: company.subscriptionPlan,
      subscriptionStatus: company.subscriptionStatus,
      trialEndsAt: company.trialEndsAt,
    })
  } catch (error) {
    console.error("Get subscription error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


