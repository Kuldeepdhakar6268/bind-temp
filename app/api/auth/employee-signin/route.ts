import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { verifyPassword, createEmployeeSession } from "@/lib/auth"
import { eq, and, or } from "drizzle-orm"
import { checkRateLimit, getClientIp, rateLimitConfigs } from "@/lib/rate-limit"
import { logSuccessfulLogin, logFailedLogin } from "@/lib/audit-log"

export async function POST(request: NextRequest) {
  try {
    // Get client info for rate limiting and audit
    const ipAddress = getClientIp(request)
    const userAgent = request.headers.get("user-agent") || undefined

    // Rate limiting - 5 attempts per minute per IP
    const rateLimitKey = `employee-signin:${ipAddress}`
    const rateLimit = checkRateLimit(rateLimitKey, rateLimitConfigs.signin)
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: "Too many login attempts. Please try again later.",
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          }
        }
      )
    }

    const body = await request.json()
    const { username, email, password, companyId } = body

    const normalizedIdentifier = (username ?? email ?? "").trim().toLowerCase()

    // Validate required fields
    if (!normalizedIdentifier || !password) {
      return NextResponse.json({ error: "Missing email/username or password" }, { status: 400 })
    }

    // Find employee by username or email and company
    const employee = await db.query.employees.findFirst({
      where: companyId 
        ? and(
            or(
              eq(schema.employees.username, normalizedIdentifier),
              eq(schema.employees.email, normalizedIdentifier)
            ),
            eq(schema.employees.companyId, parseInt(companyId))
          )
        : or(
            eq(schema.employees.username, normalizedIdentifier),
            eq(schema.employees.email, normalizedIdentifier)
          ),
    })

    if (!employee) {
      await logFailedLogin("employee", normalizedIdentifier, ipAddress, userAgent, "User not found")
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 })
    }

    // Check if employee has a password set
    if (!employee.password) {
      await logFailedLogin("employee", normalizedIdentifier, ipAddress, userAgent, "No password set", employee.companyId)
      return NextResponse.json({ error: "No password set for this employee" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, employee.password)
    if (!isValidPassword) {
      await logFailedLogin("employee", normalizedIdentifier, ipAddress, userAgent, "Invalid password", employee.companyId)
      return NextResponse.json({ error: "Invalid email/username or password" }, { status: 401 })
    }

    // Check if employee is active
    if (employee.status !== "active") {
      await logFailedLogin("employee", normalizedIdentifier, ipAddress, userAgent, "Account not active", employee.companyId)
      return NextResponse.json({ error: "Employee account is not active" }, { status: 403 })
    }

    // Create employee session with IP and user agent
    await createEmployeeSession(employee.id, employee.companyId, ipAddress, userAgent)

    // Log successful login
    await logSuccessfulLogin("employee", employee.id, employee.companyId, ipAddress, userAgent)

    return NextResponse.json({
      success: true,
      redirectTo: "/employee",
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        username: employee.username,
        role: employee.role,
        companyId: employee.companyId,
      },
    })
  } catch (error) {
    console.error("Employee signin error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


