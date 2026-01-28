import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { SignJWT } from "jose"
import { Architects_Daughter } from "next/font/google"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
)

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Find admin by email - using raw SQL since admins table isn't in Drizzle schema
    const result = await db.execute(
      sql`SELECT id, email, password_hash, first_name, last_name, role, is_active 
          FROM admins WHERE email = ${email.toLowerCase()} LIMIT 1`
    ) as unknown as Array<{
      id: number
      email: string
      password_hash: string
      first_name: string
      last_name: string
      role: string
      is_active: number | boolean
    }>

    const admin = result[0]

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // is_active is SMALLINT in DB (1 = active, 0 = inactive)
    const isActive = admin.is_active === 1 || admin.is_active === true
    if (!isActive) {
      return NextResponse.json(
        { error: "Account is disabled" },
        { status: 403 }
      )
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, admin.password_hash)
    if (!validPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Update last login
    await db!.execute(
      sql`UPDATE admins SET last_login_at = NOW() WHERE id = ${admin.id}`
    )

    // Create JWT token
    const token = await new SignJWT({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET)

    // Set cookie
    const cookieStore = await cookies()
    cookieStore.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    })

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
      },
    })  
  } catch (error) {
    console.error("Admin login error:", error)
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    )
  }
}
