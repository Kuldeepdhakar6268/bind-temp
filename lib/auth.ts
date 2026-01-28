import { cookies, headers } from "next/headers"
import { db, schema } from "@/lib/db"
import { eq, and, gt, lt } from "drizzle-orm"
import bcrypt from "bcryptjs"

const SESSION_COOKIE_NAME = "session_token"
const EMPLOYEE_SESSION_COOKIE_NAME = "employee_session_token"
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface SessionUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  companyId: number
  company: {
    id: number
    name: string
    email: string
    logo: string | null
    subscriptionPlan: string
    subscriptionStatus: string
    trialEndsAt: Date | null
  }
}

export interface EmployeeSession {
  id: number
  username: string
  firstName: string
  lastName: string
  email: string
  role: string
  companyId: number
  companyName: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateSessionToken(): string {
  return crypto.randomUUID()
}

async function getRequestIp(): Promise<string | null> {
  const headerStore = await headers()
  const forwardedFor = headerStore.get("x-forwarded-for")
  const realIp = headerStore.get("x-real-ip")
  const cfIp = headerStore.get("cf-connecting-ip")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  if (realIp) return realIp.trim()
  if (cfIp) return cfIp.trim()
  return null
}

async function getRequestUserAgent(): Promise<string | null> {
  const headerStore = await headers()
  return headerStore.get("user-agent") || null
}

/**
 * Create a new user session (stored in database for serverless compatibility)
 */
export async function createSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  // Get user's companyId
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user) {
    throw new Error("User not found")
  }

  // Store session in database
  await db.insert(schema.sessions).values({
    token,
    userId,
    companyId: user.companyId,
    type: "user",
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    expiresAt,
  })

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  })

  return token
}

/**
 * Create an employee session (stored in database for serverless compatibility)
 */
export async function createEmployeeSession(
  employeeId: number, 
  companyId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  // Store session in database
  await db.insert(schema.sessions).values({
    token,
    employeeId,
    companyId,
    type: "employee",
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    expiresAt,
  })

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(EMPLOYEE_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  })

  return token
}

/**
 * Get user session from cookie and database
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const requestIp = await getRequestIp()
  const requestUa = await getRequestUserAgent()

  if (!token) {
    return null
  }

  // Look up session in database
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.token, token),
      eq(schema.sessions.type, "user"),
      gt(schema.sessions.expiresAt, new Date())
    ),
  })

  if (!session || !session.userId) {
    return null
  }

  if (process.env.NODE_ENV === "production") {
    if (
      (session.ipAddress && requestIp && session.ipAddress !== requestIp) ||
      (session.userAgent && requestUa && session.userAgent !== requestUa)
    ) {
      await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
      return null
    }
  }

  // Get user with company data
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    with: {
      company: true,
    },
  })

  if (!user || !user.isActive) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyId: user.companyId,
    company: {
      id: user.company.id,
      name: user.company.name,
      email: user.company.email,
      logo: user.company.logo,
      subscriptionPlan: user.company.subscriptionPlan,
      subscriptionStatus: user.company.subscriptionStatus,
      trialEndsAt: user.company.trialEndsAt,
    },
  }
}

/**
 * Delete user session from database and cookie
 * @param deleteAllSessions - If true, deletes ALL sessions for this user (logs out from all devices)
 */
export async function deleteSession(deleteAllSessions: boolean = true): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    // Get the session to find the userId
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.token, token),
    })

    if (session?.userId && deleteAllSessions) {
      // Delete ALL sessions for this user (logout from all devices)
      await db.delete(schema.sessions).where(
        and(
          eq(schema.sessions.userId, session.userId),
          eq(schema.sessions.type, "user")
        )
      )
    } else {
      // Delete only the current session
      await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
    }
  }

  // Clear the cookie with explicit expiration
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  })
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Get employee session from cookie and database
 */
export async function getEmployeeSession(): Promise<EmployeeSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(EMPLOYEE_SESSION_COOKIE_NAME)?.value
  const requestIp = await getRequestIp()
  const requestUa = await getRequestUserAgent()

  if (!token) {
    return null
  }

  // Look up session in database
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.token, token),
      eq(schema.sessions.type, "employee"),
      gt(schema.sessions.expiresAt, new Date())
    ),
  })

  if (!session || !session.employeeId) {
    return null
  }

  if (
    (session.ipAddress && requestIp && session.ipAddress !== requestIp) ||
    (session.userAgent && requestUa && session.userAgent !== requestUa)
  ) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
    return null
  }

  // Get employee data
  const employee = await db.query.employees.findFirst({
    where: eq(schema.employees.id, session.employeeId),
  })

  if (!employee || employee.status !== "active") {
    return null
  }

  // Get company name
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, employee.companyId),
  })

  return {
    id: employee.id,
    username: employee.username,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    role: employee.role || "employee",
    companyId: employee.companyId,
    companyName: company?.name || "",
  }
}

/**
 * Delete employee session from database and cookie
 * @param deleteAllSessions - If true, deletes ALL sessions for this employee (logs out from all devices)
 */
export async function deleteEmployeeSession(deleteAllSessions: boolean = true): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(EMPLOYEE_SESSION_COOKIE_NAME)?.value

  if (token) {
    // Get the session to find the employeeId
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.token, token),
    })

    if (session?.employeeId && deleteAllSessions) {
      // Delete ALL sessions for this employee (logout from all devices)
      await db.delete(schema.sessions).where(
        and(
          eq(schema.sessions.employeeId, session.employeeId),
          eq(schema.sessions.type, "employee")
        )
      )
    } else {
      // Delete only the current session
      await db.delete(schema.sessions).where(eq(schema.sessions.token, token))
    }
  }

  // Clear the cookie with explicit expiration
  cookieStore.set(EMPLOYEE_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  })
  cookieStore.delete(EMPLOYEE_SESSION_COOKIE_NAME)
}

/**
 * Clean up expired sessions (call periodically via cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, new Date()))
    .returning()

  return result.length
}

