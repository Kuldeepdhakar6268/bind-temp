import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { features } from "@/lib/db/schema"
import { asc } from "drizzle-orm"

// GET /api/admin/features - Get all features grouped by type
export async function GET() {
  try {
    const allFeatures = await db
      .select()
      .from(features)
      .orderBy(asc(features.sortOrder))

    // Group features by type
    const companyFeatures = allFeatures.filter(f => f.type === 'company')
    const employeeFeatures = allFeatures.filter(f => f.type === 'employee')

    return NextResponse.json({
      success: true,
      data: {
        company: companyFeatures,
        employee: employeeFeatures,
        all: allFeatures
      }
    })
  } catch (error) {
    console.error("Error fetching features:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch features" },
      { status: 500 }
    )
  }
}
