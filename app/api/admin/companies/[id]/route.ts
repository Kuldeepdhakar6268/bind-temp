import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { sendCompanySuspensionEmail, sendCompanyActivationEmail } from "@/lib/email"
import { createValidationError } from "@/lib/api-errors"
import { isReservedEmail, getReservedEmailMessage } from "@/lib/forbidden-emails"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
)

// Verify admin session
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

interface CompanyNotificationData {
  companyName: string
  companyEmail: string | null
  adminEmail: string | null
  adminFirstName: string | null
}

async function getCompanyNotificationData(companyId: number): Promise<CompanyNotificationData | null> {
  const result = await db!.execute(sql`
    SELECT c.name, c.email as company_email, u.email as admin_email, u.first_name
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id AND u.role = 'admin'
    WHERE c.id = ${companyId}
    LIMIT 1
  `) as unknown as Array<{
    name: string
    company_email: string | null
    admin_email: string | null
    first_name: string | null
  }>

  if (result.length === 0) {
    return null
  }

  const row = result[0]
  return {
    companyName: row.name,
    companyEmail: row.company_email,
    adminEmail: row.admin_email || row.company_email,
    adminFirstName: row.first_name || "Admin",
  }
}

async function sendStatusEmail(companyId: number, newStatus: string) {
  const data = await getCompanyNotificationData(companyId)
  if (!data) return

  try {
    if (newStatus === "active") {
      await sendCompanyActivationEmail(data)
    } else if (newStatus === "suspended") {
      await sendCompanySuspensionEmail(data)
    }
  } catch (error) {
    console.error("Failed to send company status email:", error)
  }
}

async function syncCompanyAccounts(companyId: number, isActive: boolean) {
  const userActiveValue = isActive ? 1 : 0
  const employeeStatus = isActive ? "active" : "inactive"

  await db.execute(sql`
    UPDATE users SET
      is_active = ${userActiveValue},
      updated_at = NOW()
    WHERE company_id = ${companyId} AND role = 'admin'
  `)

  await db.execute(sql`
    UPDATE employees SET
      status = ${employeeStatus},
      updated_at = NOW()
    WHERE company_id = ${companyId}
  `)
}

// GET - Get single company details
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
    const result = await db.execute(sql`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) as employee_count,
        (SELECT COUNT(*) FROM customers cu WHERE cu.company_id = c.id) as customer_count,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) as job_count
      FROM companies c
      WHERE c.id = ${companyId}
      LIMIT 1
    `) as unknown as Array<Record<string, unknown>>

    if (result.length === 0) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error fetching company:", error)
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    )
  }
}

// PUT - Update company
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
  const body = await request.json()

  try {
    const { name, email, phone, subscriptionPlan, subscriptionStatus, isActive } = body

    // If isActive is explicitly provided, update subscription_status accordingly
    let effectiveStatus = subscriptionStatus
    if (typeof isActive === 'boolean') {
      effectiveStatus = isActive ? 'active' : 'suspended'
    }

    if (email && isReservedEmail(email)) {
      return createValidationError(getReservedEmailMessage("Company email"))
    }

    await db.execute(sql`
      UPDATE companies SET
        name = COALESCE(${name}, name),
        email = COALESCE(${email?.toLowerCase()}, email),
        phone = COALESCE(${phone}, phone),
        subscription_plan = COALESCE(${subscriptionPlan}, subscription_plan),
        subscription_status = COALESCE(${effectiveStatus}, subscription_status),
        updated_at = NOW()
      WHERE id = ${companyId}
    `)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating company:", error)
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    )
  }
}

// PATCH - Toggle company or employee status
export async function PATCH(
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
  const body = await request.json()
  const { action, employeeId, isActive } = body

  try {
    if (action === 'toggle-company') {
      // Toggle company status between active and suspended
      const toggleResult = await db.execute(sql`
        UPDATE companies SET
          subscription_status = CASE 
            WHEN subscription_status = 'suspended' THEN 'active'
            ELSE 'suspended'
          END,
          updated_at = NOW()
        WHERE id = ${companyId}
        RETURNING subscription_status
      `) as unknown as Array<{ subscription_status: string }>

      const updatedStatus = toggleResult[0]?.subscription_status ?? 'active'
      await syncCompanyAccounts(companyId, updatedStatus !== 'suspended')
      await sendStatusEmail(companyId, updatedStatus)

      return NextResponse.json({ success: true, message: 'Company status toggled' })
    }

    if (action === 'set-company-status') {
      // Set company status explicitly
      const status = isActive ? 'active' : 'suspended'
      await db.execute(sql`
        UPDATE companies SET
          subscription_status = ${status},
          updated_at = NOW()
        WHERE id = ${companyId}
      `)

      await syncCompanyAccounts(companyId, isActive)

      await sendStatusEmail(companyId, status)

      return NextResponse.json({ success: true, status })
    }

    if (action === 'toggle-employee' && employeeId) {
      // Toggle employee status
      await db.execute(sql`
        UPDATE employees SET
          status = CASE 
            WHEN status = 'inactive' THEN 'active'
            ELSE 'inactive'
          END,
          updated_at = NOW()
        WHERE id = ${employeeId} AND company_id = ${companyId}
      `)
      return NextResponse.json({ success: true, message: 'Employee status toggled' })
    }

    if (action === 'set-employee-status' && employeeId) {
      // Set employee status explicitly
      const status = isActive ? 'active' : 'inactive'
      await db.execute(sql`
        UPDATE employees SET
          status = ${status},
          updated_at = NOW()
        WHERE id = ${employeeId} AND company_id = ${companyId}
      `)
      return NextResponse.json({ success: true, status })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error("Error in PATCH:", error)
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    )
  }
}

// DELETE - Delete company and all related data
export async function DELETE(
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
  const database = db

  try {
    // Delete in correct order due to foreign key constraints
    // Using actual table names from schema
    
    // Delete job-related data first (deepest foreign keys)
    await database.execute(sql`DELETE FROM task_verification_photos WHERE job_task_id IN (SELECT id FROM job_tasks WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId}))`)
    await database.execute(sql`DELETE FROM job_tasks WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM job_check_ins WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM customer_signatures WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM work_sessions WHERE job_id IN (SELECT id FROM jobs WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM jobs WHERE company_id = ${companyId}`)
    
    // Delete invoice-related data
    await database.execute(sql`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM invoices WHERE company_id = ${companyId}`)
    
    // Delete quote-related data
    await database.execute(sql`DELETE FROM quote_items WHERE quote_id IN (SELECT id FROM quotes WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM quotes WHERE company_id = ${companyId}`)
    
    // Delete employee-related data
    await database.execute(sql`DELETE FROM employee_payouts WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM time_off_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM supply_requests WHERE employee_id IN (SELECT id FROM employees WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM shift_swap_requests WHERE requester_id IN (SELECT id FROM employees WHERE company_id = ${companyId}) OR target_employee_id IN (SELECT id FROM employees WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM employees WHERE company_id = ${companyId}`)
    
    // Delete customer-related data  
    await database.execute(sql`DELETE FROM customer_addresses WHERE customer_id IN (SELECT id FROM customers WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM customer_feedback WHERE customer_id IN (SELECT id FROM customers WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM customers WHERE company_id = ${companyId}`)
    
    // Delete plan-related data
    await database.execute(sql`DELETE FROM plan_tasks WHERE plan_id IN (SELECT id FROM cleaning_plans WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM cleaning_plans WHERE company_id = ${companyId}`)
    
    // Delete other company data
    await database.execute(sql`DELETE FROM contracts WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM expenses WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM messages WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM booking_requests WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM service_areas WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM equipment WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM supplies WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM shifts WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM payments WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM attachments WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM event_logs WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM job_templates WHERE company_id = ${companyId}`)
    await database.execute(sql`DELETE FROM subscriptions WHERE company_id = ${companyId}`)
    
    // Delete sessions and auth data
    await database.execute(sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = ${companyId})`)
    await database.execute(sql`DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE company_id = ${companyId})`)
    
    // Delete users
    await database.execute(sql`DELETE FROM users WHERE company_id = ${companyId}`)
    
    // Finally delete the company
    await database.execute(sql`DELETE FROM companies WHERE id = ${companyId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting company:", error)
    return NextResponse.json(
      { error: "Failed to delete company" },
      { status: 500 }
    )
  }
}
