import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { isValidUKPhone, formatUKPhone } from "@/lib/phone-validation"
import { validatePassword } from "@/lib/password-validation"
import { sendVerificationEmail } from "@/lib/email"
import { createErrorResponse, createValidationError, createConflictError } from "@/lib/api-errors"
import { isReservedEmail, getReservedEmailMessage } from "@/lib/forbidden-emails"
import { checkRateLimit, getClientIp, rateLimitConfigs } from "@/lib/rate-limit"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request)
    const rateLimit = checkRateLimit(`signup:${ip}`, rateLimitConfigs.signup)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      )
    }

    // Check if database is connected
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 }
      )
    }

    const body = await request.json()
    const {
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      companyCity,
      companyPostcode,
      businessType,
      firstName,
      lastName,
      email,
      password,
    } = body

    // Validate required fields
    if (!companyName || !companyEmail || !firstName || !lastName || !email || !password) {
      return createValidationError("Missing required fields")
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createValidationError("Invalid email format")
    }

    if (!emailRegex.test(companyEmail)) {
      return createValidationError("Invalid company email format")
    }

    if (isReservedEmail(email)) {
      return createValidationError(getReservedEmailMessage("Admin email"))
    }

    if (isReservedEmail(companyEmail)) {
      return createValidationError(getReservedEmailMessage("Company email"))
    }

    // Validate UK phone number if provided
    if (companyPhone && !isValidUKPhone(companyPhone)) {
      return createValidationError("Invalid UK phone number. Must be a valid UK mobile (07xxx xxxxxx) or landline (01xxx xxxxxx)")
    }

    // Validate password complexity
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return createValidationError(passwordValidation.errors.join(". "))
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    })

    if (existingUser) {
      return createConflictError("An account with this email already exists. Please sign in instead.")
    }

    // Check if company email already exists
    const existingCompany = await db.query.companies.findFirst({
      where: eq(schema.companies.email, companyEmail.toLowerCase()),
    })

    if (existingCompany) {
      return createConflictError("A company with this email already exists. Please use a different email.")
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex")
    const emailVerificationExpires = new Date()
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24) // 24 hours

    // Calculate trial end date (15 days from now)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 15)

    // Create company
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: companyName,
        email: companyEmail.toLowerCase(),
        phone: companyPhone ? formatUKPhone(companyPhone) : null,
        address: companyAddress || null,
        city: companyCity || null,
        postcode: companyPostcode || null,
        businessType: businessType || null,
        subscriptionPlan: "trial",
        subscriptionStatus: "active",
        trialEndsAt,
      })
      .returning()

    // Create user (not active until email verified)
    const [user] = await db
      .insert(schema.users)
      .values({
        companyId: company.id,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: "admin",
        isActive: 1,
        emailVerified: 0,
        emailVerificationToken,
        emailVerificationExpires,
      })
      .returning()

    // Send verification email
    try {
      await sendVerificationEmail(
        user.email,
        emailVerificationToken,
        `${user.firstName} ${user.lastName}`
      )
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Don't fail the signup if email fails in development
      if (process.env.NODE_ENV === "production") {
        // Rollback: delete user and company
        await db.delete(schema.users).where(eq(schema.users.id, user.id))
        await db.delete(schema.companies).where(eq(schema.companies.id, company.id))
        return createErrorResponse(emailError, "Failed to send verification email. Please try again.")
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created! Please check your email to verify your account.",
        requiresVerification: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        company: {
          id: company.id,
          name: company.name,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Signup error:", error)
    return createErrorResponse(error, "Failed to create account")
  }
}


