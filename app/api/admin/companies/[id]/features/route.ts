import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { sendFeatureUpdateEmail } from "@/lib/email"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
)

async function verifyAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value

  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.adminId as number
  } catch {
    return null
  }
}

// GET - Get company's enabled features
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const companyId = parseInt(id)

  try {
    // Get company info
    const companyResult = await db.execute(sql`
      SELECT id, name, email, max_employees, employee_rate, monthly_plan_cost
      FROM companies
      WHERE id = ${companyId}
    `) as unknown as Array<{
      id: number
      name: string
      email: string
      max_employees: number
      employee_rate: string
      monthly_plan_cost: string
    }>

    if (companyResult.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const company = companyResult[0]

    // Get all features with enabled status for this company
    const featuresResult = await db.execute(sql`
      SELECT 
        f.id,
        f.name,
        f.slug,
        f.description,
        f.type,
        f.price,
        f.is_core,
        f.sort_order,
        CASE WHEN cf.id IS NOT NULL THEN 1 ELSE 0 END as is_enabled
      FROM features f
      LEFT JOIN company_features cf ON cf.feature_id = f.id AND cf.company_id = ${companyId}
      ORDER BY f.sort_order
    `) as unknown as Array<{
      id: number
      name: string
      slug: string
      description: string | null
      type: 'company' | 'employee'
      price: string
      is_core: boolean
      sort_order: number
      is_enabled: number
    }>

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
          maxEmployees: company.max_employees,
          employeeRate: company.employee_rate,
          monthlyPlanCost: company.monthly_plan_cost,
        },
        features: featuresResult.map(f => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          description: f.description,
          type: f.type,
          price: f.price,
          isCore: f.is_core,
          sortOrder: f.sort_order,
          isEnabled: f.is_enabled === 1,
        })),
      },
    })
  } catch (error) {
    console.error("Error fetching company features:", error)
    return NextResponse.json(
      { error: "Failed to fetch company features" },
      { status: 500 }
    )
  }
}

// PUT - Update company's features
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const companyId = parseInt(id)

  try {
    const { 
      selectedFeatures, 
      maxEmployees, 
      employeeRate, 
      monthlyPlanCost,
      sendEmail = false 
    } = await request.json()

    // Get company info
    const companyResult = await db.execute(sql`
      SELECT id, name, email, monthly_plan_cost, max_employees, employee_rate
      FROM companies
      WHERE id = ${companyId}
    `) as unknown as Array<{
      id: number
      name: string
      email: string
      monthly_plan_cost: string
      max_employees: number
      employee_rate: string
    }>

    if (companyResult.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const company = companyResult[0]
    const previousMonthlyCost = parseFloat(company.monthly_plan_cost || "0")

    // Update company pricing info
    await db.execute(sql`
      UPDATE companies SET
        max_employees = ${maxEmployees},
        employee_rate = ${employeeRate},
        monthly_plan_cost = ${monthlyPlanCost},
        updated_at = NOW()
      WHERE id = ${companyId}
    `)

    // Remove all non-core features first
    await db.execute(sql`
      DELETE FROM company_features 
      WHERE company_id = ${companyId} 
      AND feature_id NOT IN (SELECT id FROM features WHERE is_core = true)
    `)

    // Add selected features
    if (selectedFeatures && selectedFeatures.length > 0) {
      for (const featureId of selectedFeatures) {
        await db.execute(sql`
          INSERT INTO company_features (company_id, feature_id, is_enabled)
          VALUES (${companyId}, ${featureId}, 1)
          ON CONFLICT (company_id, feature_id) DO NOTHING
        `)
      }
    }

    // Send update email if requested
    if (sendEmail) {
      // Get feature details
      const featureIds = selectedFeatures.map((id: number) => sql`${id}`)
      let featureDetails: Array<{ name: string; price: number; type: 'company' | 'employee' }> = []
      
      if (featureIds.length > 0) {
        const featuresResult = await db.execute(sql`
          SELECT name, price, type FROM features WHERE id IN (${sql.join(featureIds, sql`, `)})
        `) as unknown as Array<{ name: string; price: string; type: 'company' | 'employee' }>
        
        featureDetails = featuresResult.map(f => ({
          name: f.name,
          price: parseFloat(f.price),
          type: f.type,
        }))
      }

      // Get admin user email
      const adminUserResult = await db.execute(sql`
        SELECT email, first_name, last_name 
        FROM users 
        WHERE company_id = ${companyId} AND role = 'admin'
        LIMIT 1
      `) as unknown as Array<{ email: string; first_name: string; last_name: string }>

      if (adminUserResult.length > 0) {
        const adminUser = adminUserResult[0]
        
        // Get old monthly cost for comparison
        const oldCost = parseFloat(company.email) || 0 // We don't track old cost, just use 0
        
        sendFeatureUpdateEmail({
          companyName: company.name,
          companyEmail: adminUser.email,
          adminFirstName: adminUser.first_name,
          addedFeatures: featureDetails,
          maxEmployees: maxEmployees ?? company.max_employees,
          employeeRate: employeeRate ?? parseFloat(company.employee_rate || "0"),
          oldMonthlyCost: previousMonthlyCost,
          newMonthlyCost: Number(monthlyPlanCost || 0),
        }).catch((err) => {
          console.error("Failed to send feature update email:", err)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "Company features updated successfully",
    })
  } catch (error) {
    console.error("Error updating company features:", error)
    return NextResponse.json(
      { error: "Failed to update company features" },
      { status: 500 }
    )
  }
}
