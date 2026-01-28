import { NextRequest, NextResponse } from "next/server"
import { getEmployeeSession, hashPassword, verifyPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { employees } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

/**
 * PATCH /api/employee/password
 * Allow the currently signed-in employee to change their password.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    const body = await request.json()
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : ""

    if (!newPassword) {
      return NextResponse.json({ error: "New password is required" }, { status: 400 })
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` },
        { status: 400 },
      )
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters` },
        { status: 400 },
      )
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
    }

    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id),
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // If a password already exists, require the current password for safety.
    if (employee.password) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 })
      }

      const isValidCurrentPassword = await verifyPassword(currentPassword, employee.password)
      if (!isValidCurrentPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      }
    }

    const hashedPassword = await hashPassword(newPassword)

    await db
      .update(employees)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, session.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Employee password change error:", error)
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 })
  }
}

