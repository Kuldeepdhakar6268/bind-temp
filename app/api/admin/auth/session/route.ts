import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
)

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Verify token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const adminId = payload.adminId as number

    // Get admin details
    const result = await db.execute(
      sql`SELECT id, email, first_name, last_name, role, is_active 
          FROM admins WHERE id = ${adminId} LIMIT 1`
    ) as unknown as Array<{
      id: number
      email: string
      first_name: string
      last_name: string
      role: string
      is_active: number | boolean
    }>

    const admin = result[0]
    const isActive = admin?.is_active === 1 || admin?.is_active === true

    if (!admin || !isActive) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
      },
    })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401 }
    )
  }
}
