import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { eq, and, sql } from "drizzle-orm"
import { createErrorResponse, createValidationError, createConflictError } from "@/lib/api-errors"
import { isValidUKPhone, formatUKPhone } from "@/lib/phone-validation"
import { generateEmployeeCredentials } from "@/lib/employee-credentials"
import { isReservedEmail, getReservedEmailMessage } from "@/lib/forbidden-emails"

// GET all employees for the company
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const employees = await db.query.employees.findMany({
      where: eq(schema.employees.companyId, session.companyId),
      orderBy: (employees, { desc }) => [desc(employees.createdAt)],
    })

    // Never return password hashes to the client.
    const sanitizedEmployees = employees.map(({ password, ...rest }) => rest)

    return NextResponse.json(sanitizedEmployees)
  } catch (error) {
    console.error("Get employees error:", error)
    return createErrorResponse(error, "Failed to fetch employees")
  }
}

// POST create new employee
export async function POST(request: NextRequest) {
  try {
    console.log("=== CREATE EMPLOYEE API CALLED ===")
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.log("Session:", { userId: session.id, companyId: session.companyId, role: session.role })

    const body = await request.json()
    console.log("Request body:", body)
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      postcode,
      country,
      role,
      employmentType,
      startDate,
      payType,
      hourlyRate,
      salary,
      paymentFrequency,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return createValidationError("First name, last name, and email are required")
    }

    if (!phone) {
      return createValidationError("Phone number is required")
    }

    if (!address || !city || !postcode || !country) {
      return createValidationError("Address, city, postcode, and country are required")
    }

    if (!role) {
      return createValidationError("Role is required")
    }

    if (!employmentType) {
      return createValidationError("Employment type is required")
    }

    if (!startDate) {
      return createValidationError("Start date is required")
    }

    if (payType === "hourly" && !hourlyRate) {
      return createValidationError("Hourly rate is required for hourly pay type")
    }

    if (payType === "salary" && !salary) {
      return createValidationError("Salary is required for salaried employees")
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createValidationError("Invalid email format")
    }

    const emailLower = email.toLowerCase()

    if (isReservedEmail(emailLower)) {
      return createValidationError(getReservedEmailMessage("Employee email"))
    }

    // Check if employee email is the same as company email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (company && company.email.toLowerCase() === emailLower) {
      return createConflictError("Employee email cannot be the same as the company email")
    }

    // Enforce max employees limit
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM employees WHERE company_id = ${session.companyId}
    `) as Array<{ count: number }>

    const currentEmployeeCount = countResult.length > 0 ? Number(countResult[0].count ?? 0) : 0
    const maxEmployees = company?.maxEmployees ?? 0

    if (maxEmployees > 0 && currentEmployeeCount >= maxEmployees) {
      return createValidationError(
        "You have reached your employee allowance. Please contact the CleanManager admin team to increase your limit."
      )
    }

    // Check if employee email is the same as any company user email
    const companyUser = await db.query.users.findFirst({
      where: and(
        eq(schema.users.companyId, session.companyId),
        eq(schema.users.email, emailLower)
      ),
    })

    if (companyUser) {
      return createConflictError("Employee email cannot be the same as a company user email")
    }

    // Validate UK phone number if provided
    if (!isValidUKPhone(phone)) {
      return createValidationError("Invalid UK phone number. Must be a valid UK mobile (07xxx xxxxxx) or landline (01xxx xxxxxx)")
    }

    // Check if employee email already exists in this company
    const existingEmployee = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.companyId, session.companyId),
        eq(schema.employees.email, emailLower)
      ),
    })

    if (existingEmployee) {
      return createConflictError("An employee with this email already exists in your company")
    }

    // Check if phone number already exists in this company
    const formattedPhone = formatUKPhone(phone)
    const existingPhone = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.companyId, session.companyId),
        eq(schema.employees.phone, formattedPhone)
      ),
    })

    if (existingPhone) {
      return createConflictError("An employee with this phone number already exists in your company")
    }

    // Validate start date (cannot be in the past)
    if (startDate) {
      const start = new Date(startDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (start < today) {
        return createValidationError("Start date cannot be in the past")
      }
    }

    // Generate employee credentials
    console.log("Generating employee credentials...")
    const credentials = await generateEmployeeCredentials()

    // Create employee
    console.log("About to insert employee into database...")
    const [newEmployee] = await db
      .insert(schema.employees)
      .values({
        companyId: session.companyId,
        firstName,
        lastName,
        email: emailLower,
        phone: formattedPhone,
        address,
        city: city || null,
        postcode,
        country: country || "UK",
        username: emailLower,
        password: credentials.hashedPassword,
        role: role || null,
        employmentType: employmentType || null,
        startDate: startDate ? new Date(startDate) : null,
        payType: payType || "hourly",
        hourlyRate: hourlyRate || null,
        salary: salary || null,
        paymentFrequency: paymentFrequency || null,
        status: "active",
      })
      .returning()

    console.log("Employee created successfully:", newEmployee)

    const { password: _password, ...employeeWithoutPassword } = newEmployee

    // Return employee with plain text password (only shown once)
    return NextResponse.json(
      {
        ...employeeWithoutPassword,
        plainPassword: credentials.password, // Include plain password in response
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("=== CREATE EMPLOYEE ERROR ===")
    console.error("Error type:", error?.constructor?.name)
    console.error("Error message:", error instanceof Error ? error.message : error)
    console.error("Full error:", error)
    return createErrorResponse(error, "Failed to create employee")
  }
}


