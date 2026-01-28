import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { eq, and, ne } from "drizzle-orm"
import { createErrorResponse, createValidationError, createConflictError } from "@/lib/api-errors"
import { formatUKPhone } from "@/lib/phone-validation"

// GET single employee
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const employeeId = parseInt(id)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    }

    const employee = await db.query.employees.findFirst({
      where: and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, session.companyId)),
    })

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error("Get employee error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT update employee
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const employeeId = parseInt(id)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      photo,
      dateOfBirth,
      address,
      city,
      postcode,
      country,
      role,
      employmentType,
      status,
      startDate,
      endDate,
      hourlyRate,
      salary,
      paymentFrequency,
      payType,
      skills,
      certifications,
      languages,
      performanceRating,
      availability,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      notes,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "First name, last name, and email are required" }, { status: 400 })
    }

    if (payType === "hourly" && !hourlyRate) {
      return NextResponse.json({ error: "Hourly rate is required for hourly pay type" }, { status: 400 })
    }

    if (payType === "salary" && !salary) {
      return NextResponse.json({ error: "Salary is required for salaried employees" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const emailLower = email.toLowerCase()

    // Check if employee email is the same as company email
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (company && company.email.toLowerCase() === emailLower) {
      return createConflictError("Employee email cannot be the same as the company email")
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

    // Check for duplicate email (excluding current employee)
    if (email) {
      const duplicateEmail = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.companyId, session.companyId),
          eq(schema.employees.email, emailLower),
          ne(schema.employees.id, employeeId)
        ),
      })

      if (duplicateEmail) {
        return createConflictError("An employee with this email already exists in your company")
      }
    }

    // Check for duplicate phone (excluding current employee)
    if (phone) {
      const formattedPhone = formatUKPhone(phone)
      const duplicatePhone = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.companyId, session.companyId),
          eq(schema.employees.phone, formattedPhone),
          ne(schema.employees.id, employeeId)
        ),
      })

      if (duplicatePhone) {
        return createConflictError("An employee with this phone number already exists in your company")
      }
    }

    // Update employee
    const [updatedEmployee] = await db
      .update(schema.employees)
      .set({
        firstName,
        lastName,
        email: emailLower,
        phone: phone ? formatUKPhone(phone) : null,
        alternatePhone: alternatePhone ? formatUKPhone(alternatePhone) : null,
        photo: photo || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        country: country || "UK",
        role: role || null,
        employmentType: employmentType || null,
        status: status || "active",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        hourlyRate: hourlyRate || null,
        salary: salary || null,
        paymentFrequency: paymentFrequency || null,
        payType: payType || null,
        skills: skills || null,
        certifications: certifications || null,
        languages: languages || null,
        performanceRating: performanceRating || null,
        availability: availability || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, session.companyId)))
      .returning()

    if (!updatedEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json(updatedEmployee)
  } catch (error) {
    console.error("Update employee error:", error)
    return createErrorResponse(error, "Failed to update employee")
  }
}

// DELETE employee
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const employeeId = parseInt(id)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    }

    // Check if employee exists and belongs to this company
    const existingEmployee = await db.query.employees.findFirst({
      where: and(
        eq(schema.employees.id, employeeId),
        eq(schema.employees.companyId, session.companyId)
      ),
    })

    if (!existingEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    // Check if employee has pending/in-progress jobs assigned
    const pendingJobs = await db.query.jobs.findMany({
      where: and(
        eq(schema.jobs.assignedTo, employeeId),
        eq(schema.jobs.companyId, session.companyId),
        // Jobs that are not completed, cancelled, or invoiced
        ne(schema.jobs.status, "completed"),
        ne(schema.jobs.status, "cancelled"),
        ne(schema.jobs.status, "invoiced")
      ),
    })

    if (pendingJobs.length > 0) {
      return NextResponse.json({ 
        error: `Cannot delete employee. They have ${pendingJobs.length} pending or in-progress job(s). Please reassign or complete these jobs first.` 
      }, { status: 409 })
    }

    // First, clean up any sessions for this employee
    await db.delete(schema.sessions).where(eq(schema.sessions.employeeId, employeeId))

    // Delete employee (cascade will handle work_sessions, shifts, time_off_requests)
    const [deletedEmployee] = await db
      .delete(schema.employees)
      .where(and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, session.companyId)))
      .returning()

    if (!deletedEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Employee deleted successfully" })
  } catch (error: any) {
    console.error("Delete employee error:", error)
    
    // Handle specific database errors
    if (error.code === '23503') {
      return NextResponse.json({ 
        error: "Cannot delete employee because they have related records. Please remove related data first." 
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: "Failed to delete employee. Please try again." 
    }, { status: 500 })
  }
}

