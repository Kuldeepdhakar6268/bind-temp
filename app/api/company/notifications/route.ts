import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { eq } from "drizzle-orm"
import {
  defaultCompanyNotificationSettings,
  normalizeCompanyNotificationSettings,
  CompanyNotificationSettings,
} from "@/lib/notification-settings"

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

    const settings = normalizeCompanyNotificationSettings(company.notificationSettings)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Get company notifications error:", error)
    return NextResponse.json({ error: "Failed to load notification settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const incoming = body?.settings ?? body

    const normalized: CompanyNotificationSettings = normalizeCompanyNotificationSettings(incoming)

    const [updated] = await db
      .update(schema.companies)
      .set({
        notificationSettings: normalized,
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, session.companyId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({ settings: normalized })
  } catch (error) {
    console.error("Update company notifications error:", error)
    return NextResponse.json({
      error: "Failed to update notification settings",
      settings: defaultCompanyNotificationSettings,
    }, { status: 500 })
  }
}
