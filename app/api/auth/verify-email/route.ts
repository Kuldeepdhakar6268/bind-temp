import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, gt } from "drizzle-orm"
import { createSession } from "@/lib/auth"
import { sendWelcomeEmail } from "@/lib/email"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      )
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 }
      )
    }

    // Find user with valid token
    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.emailVerificationToken, token),
        gt(schema.users.emailVerificationExpires, new Date())
      ),
      with: {
        company: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired verification token" },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.emailVerified === 1) {
      return NextResponse.json({
        success: true,
        message: "Email already verified. You can sign in.",
        alreadyVerified: true,
      })
    }

    // Mark email as verified and clear token
    await db
      .update(schema.users)
      .set({
        emailVerified: 1,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))

    // Create session (auto-login after verification)
    await createSession(user.id)

    // Get company info safely
    const company = user.company && !Array.isArray(user.company) ? user.company : null
    const companyName = company?.name || "your company"

    // Send welcome email
    try {
      await sendWelcomeEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        companyName
      )
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError)
      // Don't fail verification if welcome email fails
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! Welcome to CleanManager.",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      company: company ? {
        id: company.id,
        name: company.name,
      } : null,
    })
  } catch (error) {
    console.error("Email verification error:", error)
    return NextResponse.json(
      { error: "An error occurred during verification. Please try again." },
      { status: 500 }
    )
  }
}

