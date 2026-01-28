import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { companies, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// POST /api/admin/companies/validate-emails - Check if emails are already in use
export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const { companyEmail, adminEmail } = await request.json()
    
    const errors: { company?: string; admin?: string } = {}
    
    // Check if company email exists
    if (companyEmail) {
      const existingCompany = await db
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.email, companyEmail.toLowerCase()))
        .limit(1)
      
      if (existingCompany.length > 0) {
        errors.company = "This email is already registered to another company"
      }
    }
    
    // Check if admin email exists
    if (adminEmail) {
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, adminEmail.toLowerCase()))
        .limit(1)
      
      if (existingUser.length > 0) {
        errors.admin = "This email is already registered to another user"
      }
    }
    
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ valid: false, errors })
    }
    
    return NextResponse.json({ valid: true })
    
  } catch (error) {
    console.error("Error validating emails:", error)
    return NextResponse.json(
      { valid: false, error: "Failed to validate emails" },
      { status: 500 }
    )
  }
}
