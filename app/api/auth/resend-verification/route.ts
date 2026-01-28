import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { sendVerificationEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      )
    }

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with that email, a verification link has been sent.",
      })
    }

    // Check if already verified
    if (user.emailVerified === 1) {
      return NextResponse.json({
        success: true,
        message: "Email is already verified. You can sign in.",
        alreadyVerified: true,
      })
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex")
    const emailVerificationExpires = new Date()
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24)

    // Update user with new token
    await db
      .update(schema.users)
      .set({
        emailVerificationToken,
        emailVerificationExpires,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email,
        emailVerificationToken,
        `${user.firstName} ${user.lastName}`
      )
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again later." },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a verification link has been sent.",
    })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

