import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { customers, companies } from "@/lib/db/schema"
import { eq, and, gt } from "drizzle-orm"
import { sign } from "jsonwebtoken"
import crypto from "crypto"
import { sendCustomerPortalLoginCode } from "@/lib/email"

// SECURITY: JWT_SECRET must be set in environment - no fallback allowed
const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) {
  console.error("CRITICAL: NEXTAUTH_SECRET is not set!")
}

// In-memory store for login codes (use Redis in production)
const loginCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>()
const MAX_ATTEMPTS = 3
const CODE_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes

// Rate limiting for auth requests
const rateLimits = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimits.get(ip)
  
  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  limit.count++
  return true
}

// POST /api/customer-portal/auth - Customer login with email + code verification
export async function POST(request: NextRequest) {
  try {
    // Check JWT secret is configured
    if (!JWT_SECRET) {
      console.error("JWT_SECRET not configured")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
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
    const { email, code } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      )
    }

    const emailLower = email.toLowerCase()

    // Verify the code
    const storedData = loginCodes.get(emailLower)
    
    if (!storedData) {
      return NextResponse.json(
        { error: "No login code found. Please request a new code." },
        { status: 400 }
      )
    }

    // Check if code expired
    if (Date.now() > storedData.expiresAt) {
      loginCodes.delete(emailLower)
      return NextResponse.json(
        { error: "Code has expired. Please request a new code." },
        { status: 400 }
      )
    }

    // Check attempts
    if (storedData.attempts >= MAX_ATTEMPTS) {
      loginCodes.delete(emailLower)
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      )
    }

    // Verify code using timing-safe comparison
    const codeMatches = crypto.timingSafeEqual(
      Buffer.from(code.toString()),
      Buffer.from(storedData.code)
    )

    if (!codeMatches) {
      storedData.attempts++
      return NextResponse.json(
        { error: "Invalid code. Please try again." },
        { status: 400 }
      )
    }

    // Code is valid - delete it (one-time use)
    loginCodes.delete(emailLower)

    // Find customer by email
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, emailLower))
      .limit(1)

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      )
    }

    // Generate JWT token
    const token = sign(
      {
        customerId: customer.id,
        email: customer.email,
        type: "customer",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    )

    return NextResponse.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name || `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
      },
    })
  } catch (error) {
    console.error("Error in customer portal auth:", error)
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    )
  }
}

// GET /api/customer-portal/auth - Send magic link/code to customer email
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
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

    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const emailLower = email.toLowerCase()

    // Find customer by email
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, emailLower))
      .limit(1)

    // Always return same message to prevent email enumeration
    const genericMessage = "If a customer account exists with this email, a login code has been sent."

    if (!customer) {
      // Don't reveal if customer exists or not for security
      return NextResponse.json({ message: genericMessage })
    }

    // Generate a secure 6-digit code using crypto
    const code = crypto.randomInt(100000, 999999).toString()

    // Store code with expiration
    loginCodes.set(emailLower, {
      code,
      expiresAt: Date.now() + CODE_EXPIRY_MS,
      attempts: 0,
    })

    // Send email with code
    try {
      // Get company name for branding (use first company the customer belongs to)
      const companyName = "CleanManager"
      
      await sendCustomerPortalLoginCode(emailLower, code, companyName)
    } catch (emailError) {
      console.error("Failed to send login code email:", emailError)
      // Don't fail the request if email fails in development
      if (process.env.NODE_ENV !== "development") {
        return NextResponse.json(
          { error: "Failed to send login code. Please try again." },
          { status: 500 }
        )
      }
    }

    // In development, also log the code
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Login code for ${emailLower}: ${code}`)
    }

    return NextResponse.json({
      message: genericMessage,
      // Only expose code in development for testing
      ...(process.env.NODE_ENV === "development" && { devCode: code }),
    })
  } catch (error) {
    console.error("Error sending customer login code:", error)
    return NextResponse.json(
      { error: "Failed to send login code" },
      { status: 500 }
    )
  }
}


