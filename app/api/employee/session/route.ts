import { NextResponse } from "next/server"
import { getEmployeeSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { employees, companies } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * GET /api/employee/session
 * Get the current employee's session and full profile data
 */
export async function GET() {
  try {
    const session = await getEmployeeSession()

    if (!session) {
      return NextResponse.json(null, { status: 200 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 })
    }

    // Get full employee data
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.id),
    })

    if (!employee) {
      return NextResponse.json(null, { status: 200 })
    }

    // Get company data
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, employee.companyId),
    })

    return NextResponse.json({
      id: employee.id,
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role || "Employee",
      phone: employee.phone,
      alternatePhone: employee.alternatePhone,
      address: employee.address,
      city: employee.city,
      postcode: employee.postcode,
      country: employee.country,
      dateOfBirth: employee.dateOfBirth,
      employmentType: employee.employmentType,
      startDate: employee.startDate,
      hourlyRate: employee.hourlyRate,
      skills: employee.skills,
      certifications: employee.certifications,
      languages: employee.languages,
      availability: employee.availability,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactRelation: employee.emergencyContactRelation,
      notes: employee.notes,
      status: employee.status,
      company: {
        id: company?.id,
        name: company?.name || "",
      },
    })
  } catch (error) {
    console.error("Employee session error:", error)
    return NextResponse.json(null, { status: 500 })
  }
}
