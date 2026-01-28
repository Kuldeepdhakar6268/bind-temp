import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { sendPasswordResetEmail } from "@/lib/email"
import crypto from "crypto"
import { checkRateLimit, getClientIp, rateLimitConfigs } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = checkRateLimit(`forgot-password:${ip}`, rateLimitConfigs.forgotPassword)
    if (!rateLimit.success) {
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

    const body = await request.json()
    const { email } = body

    // Validate email
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    })

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString("hex")

      // Token expires in 1 hour
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 1)

      // Store token in database
      await db.insert(schema.passwordResetTokens).values({
        userId: user.id,
        token: resetToken,
        expiresAt,
      })

      // Send password reset email
      try {
        await sendPasswordResetEmail(
          user.email,
          resetToken,
          `${user.firstName} ${user.lastName}`
        )
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError)
        // Don't fail the request if email fails in development
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Failed to send reset email. Please try again later." },
            { status: 500 }
          )
        }
      }
    }

    // Always return success message
    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a password reset link has been sent.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}


