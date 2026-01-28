import { NextRequest, NextResponse } from "next/server"
import { getSession, hashPassword } from "@/lib/auth"
import { buildAppUrl, sendEmployeeCredentialsEmail } from "@/lib/email"
import { db } from "@/lib/db"
import { companies, employees } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { generatePassword } from "@/lib/employee-credentials"

/**
 * POST /api/employees/send-credentials
 * Send employee login credentials via email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { employeeId, email, employeeName, username, password } = body

    let resolvedEmail = email
    let resolvedEmployeeName = employeeName
    let resolvedUsername = username
    let resolvedPassword = password

    if (employeeId) {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(employees.id, parseInt(employeeId)),
          eq(employees.companyId, session.companyId)
        ),
      })

      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 })
      }

      resolvedEmail = employee.email
      resolvedEmployeeName = `${employee.firstName} ${employee.lastName}`.trim()
      resolvedUsername = employee.username || ""
      resolvedPassword = generatePassword()

      const hashedPassword = await hashPassword(resolvedPassword)
      await db
        .update(employees)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(employees.id, employee.id))
    }

    // Validate required fields
    if (!resolvedEmail || !resolvedEmployeeName || !resolvedUsername || !resolvedPassword) {
      return NextResponse.json(
        { error: "Missing required fields: email, employeeName, username, password" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(resolvedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Get company name for the email
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, session.companyId),
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Send the credentials email
    await sendEmployeeCredentialsEmail({
      email: resolvedEmail,
      name: resolvedEmployeeName,
      password: resolvedPassword,
      companyName: company.name,
      loginUrl: buildAppUrl("/login"),
    })

    return NextResponse.json({
      success: true,
      message: "Credentials sent successfully",
    })
  } catch (error) {
    console.error("Error sending credentials email:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send credentials email" },
      { status: 500 }
    )
  }
}

