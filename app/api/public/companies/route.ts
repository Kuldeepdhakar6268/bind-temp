import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { companies } from "@/lib/db/schema"
import { or, eq } from "drizzle-orm"

/**
 * GET /api/public/companies
 * Public endpoint to list active cleaning companies for booking
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    // Get all active companies (only return public info)
    // Include both "active" and "trial" status companies
    const companyList = await db
      .select({
        id: companies.id,
        name: companies.name,
        city: companies.city,
        logo: companies.logo,
      })
      .from(companies)
      .where(
        or(
          eq(companies.subscriptionStatus, "active"),
          eq(companies.subscriptionStatus, "trial")
        )
      )

    return NextResponse.json(companyList)
  } catch (error) {
    console.error("Error fetching public companies:", error)
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    )
  }
}
