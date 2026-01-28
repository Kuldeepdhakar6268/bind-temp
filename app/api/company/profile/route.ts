import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { createValidationError } from "@/lib/api-errors"
import { isReservedEmail, getReservedEmailMessage } from "@/lib/forbidden-emails"

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error("Get company profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, address, city, postcode, country, website, businessType, taxId, numberOfEmployees } =
      body

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Validate numberOfEmployees
    if (numberOfEmployees !== undefined && (numberOfEmployees < 1 || !Number.isInteger(numberOfEmployees))) {
      return NextResponse.json({ error: "Number of employees must be at least 1" }, { status: 400 })
    }

    if (numberOfEmployees !== undefined && company.maxEmployees !== undefined && numberOfEmployees > company.maxEmployees) {
      return createValidationError(
        `Number of employees cannot exceed admin limit of ${company.maxEmployees}.`
      )
    }

    if (isReservedEmail(email)) {
      return createValidationError(getReservedEmailMessage("Company email"))
    }

    // Update company
    const [updatedCompany] = await db
      .update(schema.companies)
      .set({
        name,
        email,
        phone: phone || null,
        address: address || null,
        city: city || null,
        postcode: postcode || null,
        country: country || "UK",
        website: website || null,
        businessType: businessType || null,
        taxId: taxId || null,
        numberOfEmployees: numberOfEmployees || 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, session.companyId))
      .returning()

    return NextResponse.json(updatedCompany)
  } catch (error) {
    console.error("Update company profile error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


