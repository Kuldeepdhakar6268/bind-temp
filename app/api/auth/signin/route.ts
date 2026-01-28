import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { verifyPassword, createSession } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { checkRateLimit, getClientIp, rateLimitConfigs } from "@/lib/rate-limit"
import { logSuccessfulLogin, logFailedLogin } from "@/lib/audit-log"

export async function POST(request: NextRequest) {
  try {
    // Get client info for rate limiting and audit
    const ip = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || undefined
    
    // Rate limiting
    const rateLimit = checkRateLimit(`signin:${ip}`, rateLimitConfigs.signin)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      )
    }

    // Check database connection
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
      with: {
        company: true,
      },
    })

    if (!user) {
      await logFailedLogin("user", email, ip, userAgent, "User not found")
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash)
    if (!isValidPassword) {
      await logFailedLogin("user", email, ip, userAgent, "Invalid password", user.companyId)
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    // Check if email is verified
    if (user.emailVerified === 0) {
      await logFailedLogin("user", email, ip, userAgent, "Email not verified", user.companyId)
      return NextResponse.json(
        { 
          error: "Please verify your email before signing in. Check your inbox for the verification link.",
          requiresVerification: true,
          email: user.email
        }, 
        { status: 403 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      await logFailedLogin("user", email, ip, userAgent, "Account disabled", user.companyId)
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 })
    }

    // Update last login
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id))

    // Create session with IP and user agent
    await createSession(user.id, ip, userAgent)
    
    // Log successful login
    await logSuccessfulLogin("user", user.id, user.companyId, ip, userAgent)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      company: {
        id: user.company.id,
        name: user.company.name,
      },
    })
  } catch (error) {
    console.error("Signin error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


