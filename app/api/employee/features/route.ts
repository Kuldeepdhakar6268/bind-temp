import { NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// GET /api/employee/features - Get enabled features for the employee's company
export async function GET() {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId

    if (!companyId) {
      return NextResponse.json({ error: "No company associated" }, { status: 400 })
    }

    // Check if company has any features configured
    const configuredCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM company_features WHERE company_id = ${companyId}
    `) as unknown as Array<{ count: string | number }>
    
    const hasConfiguredFeatures = Number(configuredCount[0]?.count) > 0

    let allFeatures: Array<{
      id: number
      slug: string
      name: string
      type: 'company' | 'employee'
      is_core: boolean
    }> = []

    if (hasConfiguredFeatures) {
      // Get features that are explicitly enabled for this company
      const featuresResult = await db.execute(sql`
        SELECT 
          f.id,
          f.slug,
          f.name,
          f.type,
          f.is_core
        FROM features f
        INNER JOIN company_features cf ON cf.feature_id = f.id AND cf.company_id = ${companyId}
        WHERE cf.is_enabled = 1
        ORDER BY f.sort_order
      `) as unknown as Array<{
        id: number
        slug: string
        name: string
        type: 'company' | 'employee'
        is_core: boolean
      }>

      // Also include core features that might not be in company_features
      const coreResult = await db.execute(sql`
        SELECT 
          f.id,
          f.slug,
          f.name,
          f.type,
          f.is_core
        FROM features f
        WHERE f.is_core = true
        AND f.id NOT IN (
          SELECT feature_id FROM company_features WHERE company_id = ${companyId}
        )
      `) as unknown as Array<{
        id: number
        slug: string
        name: string
        type: 'company' | 'employee'
        is_core: boolean
      }>

      allFeatures = [...featuresResult, ...coreResult]
    } else {
      // No features configured - return ALL features as enabled (default state)
      const allFeaturesResult = await db.execute(sql`
        SELECT 
          f.id,
          f.slug,
          f.name,
          f.type,
          f.is_core
        FROM features f
        ORDER BY f.sort_order
      `) as unknown as Array<{
        id: number
        slug: string
        name: string
        type: 'company' | 'employee'
        is_core: boolean
      }>
      
      allFeatures = allFeaturesResult
    }

    return NextResponse.json({
      success: true,
      features: allFeatures.map(f => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        type: f.type,
        isCore: f.is_core,
      })),
    })
  } catch (error) {
    console.error("Error fetching employee features:", error)
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    )
  }
}
