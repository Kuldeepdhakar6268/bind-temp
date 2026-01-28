import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { sendWelcomeCompanyEmail } from "@/lib/email"
import { createValidationError } from "@/lib/api-errors"
import { isReservedEmail, getReservedEmailMessage } from "@/lib/forbidden-emails"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
)

// Verify admin session middleware
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

// GET - List all companies with stats
export async function GET() {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.subscription_plan as "subscriptionPlan",
        c.subscription_status as "subscriptionStatus",
        c.number_of_employees as "numberOfEmployees",
        c.max_employees as "maxEmployees",
        c.employee_rate as "employeeRate",
        c.monthly_plan_cost as "monthlyPlanCost",
        c.created_at as "createdAt",
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) as "employeeCount",
        (SELECT COUNT(*) FROM customers cu WHERE cu.company_id = c.id) as "customerCount",
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) as "jobCount"
      FROM companies c
      ORDER BY c.created_at DESC
    `)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching companies:", error)
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    )
  }
}

// POST - Create new company with admin user
export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const adminId = await verifyAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      email,
      phone,
      address,
      city,
      postcode,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      selectedFeatures,
      maxEmployees,
      employeeRate,
      monthlyPlanCost,
    } = body

    // Validate required fields
    if (!name || !email || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (isReservedEmail(email)) {
      return createValidationError(getReservedEmailMessage("Company email"))
    }

    if (isReservedEmail(adminEmail)) {
      return createValidationError(getReservedEmailMessage("Company admin email"))
    }

    // Check if company email already exists
    const existingCompany = await db.execute(
      sql`SELECT id FROM companies WHERE email = ${email.toLowerCase()} LIMIT 1`
    ) as unknown as Array<{ id: number }>
    if (existingCompany.length > 0) {
      return NextResponse.json(
        { error: "Company with this email already exists" },
        { status: 400 }
      )
    }

    // Check if admin email already exists
    const existingUser = await db.execute(
      sql`SELECT id FROM users WHERE email = ${adminEmail.toLowerCase()} LIMIT 1`
    ) as unknown as Array<{ id: number }>
    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Create company with new fields
    const companyResult = await db.execute(sql`
      INSERT INTO companies (
        name, 
        email, 
        phone,
        address,
        city,
        postcode,
        subscription_plan, 
        subscription_status,
        max_employees,
        employee_rate,
        monthly_plan_cost,
        created_at,
        updated_at
      ) VALUES (
        ${name},
        ${email.toLowerCase()},
        ${phone || null},
        ${address || null},
        ${city || null},
        ${postcode || null},
        'custom',
        'active',
        ${maxEmployees || 5},
        ${employeeRate || 20},
        ${monthlyPlanCost || 0},
        NOW(),
        NOW()
      )
      RETURNING id
    `) as unknown as Array<{ id: number }>

    const companyId = companyResult[0].id

    // Add selected features to company_features
    if (selectedFeatures && selectedFeatures.length > 0) {
      for (const featureId of selectedFeatures) {
        await db.execute(sql`
          INSERT INTO company_features (company_id, feature_id, is_enabled)
          VALUES (${companyId}, ${featureId}, 1)
          ON CONFLICT (company_id, feature_id) DO NOTHING
        `)
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 10)

    // Create admin user for the company
    await db!.execute(sql`
      INSERT INTO users (
        company_id,
        email,
        password_hash,
        first_name,
        last_name,
        role,
        email_verified,
        created_at,
        updated_at
      ) VALUES (
        ${companyId},
        ${adminEmail.toLowerCase()},
        ${passwordHash},
        ${adminFirstName},
        ${adminLastName},
        'admin',
        1,
        NOW(),
        NOW()
      )
    `)

    // Get feature details for the welcome email
    let featureDetails: Array<{ name: string; price: number; type: 'company' | 'employee' }> = []
    if (selectedFeatures && selectedFeatures.length > 0) {
      const featureIds = selectedFeatures.map((id: number) => sql`${id}`)
      const featuresResult = await db.execute(sql`
        SELECT name, price, type FROM features WHERE id IN (${sql.join(featureIds, sql`, `)})
      `) as unknown as Array<{ name: string; price: string; type: 'company' | 'employee' }>
      
      featureDetails = featuresResult.map(f => ({
        name: f.name,
        price: parseFloat(f.price),
        type: f.type,
      }))
    }

    // Send welcome email (fire and forget - don't block the response)
    sendWelcomeCompanyEmail({
      companyName: name,
      companyEmail: email.toLowerCase(),
      adminFirstName,
      adminLastName,
      adminEmail: adminEmail.toLowerCase(),
      password: adminPassword,
      features: featureDetails,
      maxEmployees: maxEmployees || 5,
      employeeRate: employeeRate || 20,
      monthlyPlanCost: monthlyPlanCost || 0,
    }).catch((err) => {
      console.error("Failed to send welcome email:", err)
    })

    return NextResponse.json({
      success: true,
      companyId,
      message: "Company and admin account created successfully",
    })
  } catch (error) {
    console.error("Error creating company:", error)
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    )
  }
}
