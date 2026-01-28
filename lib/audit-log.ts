import { db, schema } from "@/lib/db"

export type AuditEventType = 
  | "user_login"
  | "user_logout"
  | "user_login_failed"
  | "employee_login"
  | "employee_logout"
  | "employee_login_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "session_created"
  | "session_expired"
  | "account_locked"
  | "account_unlocked"

export interface AuditLogParams {
  companyId: number
  eventType: AuditEventType
  entityType?: "user" | "employee" | "session"
  entityId?: number
  userId?: number
  employeeId?: number
  description: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a security/audit event to the database
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(schema.eventLogs).values({
      companyId: params.companyId,
      eventType: params.eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      employeeId: params.employeeId,
      description: params.description,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error("Failed to log audit event:", error)
  }
}

/**
 * Log a failed login attempt (useful for security monitoring)
 */
export async function logFailedLogin(
  type: "user" | "employee",
  identifier: string,
  ipAddress?: string,
  userAgent?: string,
  reason?: string,
  companyId?: number
): Promise<void> {
  if (!companyId || companyId <= 0) {
    return
  }

  await logAuditEvent({
    companyId,
    eventType: type === "user" ? "user_login_failed" : "employee_login_failed",
    entityType: type,
    description: `Failed login attempt for ${type}: ${identifier}. Reason: ${reason || "Invalid credentials"}`,
    metadata: { identifier, reason },
    ipAddress,
    userAgent,
  })
}

/**
 * Log a successful login
 */
export async function logSuccessfulLogin(
  type: "user" | "employee",
  id: number,
  companyId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    companyId,
    eventType: type === "user" ? "user_login" : "employee_login",
    entityType: type,
    entityId: id,
    userId: type === "user" ? id : undefined,
    employeeId: type === "employee" ? id : undefined,
    description: `${type === "user" ? "User" : "Employee"} logged in successfully`,
    ipAddress,
    userAgent,
  })
}

/**
 * Log a logout event
 */
export async function logLogout(
  type: "user" | "employee",
  id: number,
  companyId: number,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent({
    companyId,
    eventType: type === "user" ? "user_logout" : "employee_logout",
    entityType: type,
    entityId: id,
    userId: type === "user" ? id : undefined,
    employeeId: type === "employee" ? id : undefined,
    description: `${type === "user" ? "User" : "Employee"} logged out`,
    ipAddress,
  })
}
