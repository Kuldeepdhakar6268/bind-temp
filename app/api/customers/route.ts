import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, or, ilike, desc } from "drizzle-orm"
import { createErrorResponse, createValidationError, createConflictError } from "@/lib/api-errors"
import { isValidUKPhone, formatUKPhone } from "@/lib/phone-validation"

// GET /api/customers - Get all customers for the company
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    let query = db.query.customers.findMany({
      where: and(
        eq(schema.customers.companyId, session.companyId),
        search
          ? or(
              ilike(schema.customers.firstName, `%${search}%`),
              ilike(schema.customers.lastName, `%${search}%`),
              ilike(schema.customers.email, `%${search}%`),
              ilike(schema.customers.phone, `%${search}%`),
            )
          : undefined,
        type ? eq(schema.customers.customerType, type) : undefined,
        status ? eq(schema.customers.status, status) : undefined,
      ),
      orderBy: [desc(schema.customers.createdAt)],
      with: {
        addresses: true,
      },
    })

    const customers = await query

    // Add computed name field for convenience
    const customersWithName = customers.map(customer => ({
      ...customer,
      name: `${customer.firstName} ${customer.lastName}`,
    }))

    return NextResponse.json(customersWithName)
  } catch (error) {
    console.error("Get customers error:", error)
    return createErrorResponse(error, "Failed to fetch customers")
  }
}

// POST /api/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    console.log("=== CREATE CUSTOMER API CALLED ===")
    const session = await requireAuth()
    console.log("Session:", { userId: session.id, companyId: session.companyId, role: session.role })

    const body = await request.json()
    console.log("Request body:", body)

    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      address,
      addressLine2,
      city,
      postcode,
      country,
      customerType,
      status,
      billingAddress,
      billingCity,
      billingPostcode,
      billingCountry,
      taxId,
      preferredContactMethod,
      specialInstructions,
      accessInstructions,
      parkingInstructions,
      companyName,
      businessType,
      source,
      referredBy,
      notes,
      additionalAddresses,
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
    if (additionalAddresses && !Array.isArray(additionalAddresses)) {
      return createValidationError("Additional addresses must be an array")
    }
    if (Array.isArray(additionalAddresses)) {
      for (const addr of additionalAddresses) {
        if (!addr?.address || !addr?.city || !addr?.postcode || !addr?.country) {
          return createValidationError("Additional addresses require address, city, postcode, and country")
        }
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return createValidationError("Invalid email format")
    }

    // Validate UK phone number if provided
    if (!isValidUKPhone(phone)) {
      return createValidationError("Invalid UK phone number. Must be a valid UK mobile (07xxx xxxxxx) or landline (01xxx xxxxxx)")
    }

    // Validate alternate phone if provided
    if (alternatePhone && !isValidUKPhone(alternatePhone)) {
      return createValidationError("Invalid alternate UK phone number. Must be a valid UK mobile (07xxx xxxxxx) or landline (01xxx xxxxxx)")
    }

    // Check if customer with this email already exists for this company
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.companyId, session.companyId),
        eq(schema.customers.email, email),
      ),
    })

    if (existingCustomer) {
      return createConflictError("A customer with this email already exists in your company")
    }

    // Check if phone number already exists in this company
    const formattedPhone = formatUKPhone(phone)
    const existingPhone = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.companyId, session.companyId),
        eq(schema.customers.phone, formattedPhone)
      ),
    })

    if (existingPhone) {
      return createConflictError("A customer with this phone number already exists in your company")
    }

    // Create customer
    console.log("About to insert customer into database...")
    const [customer] = await db
      .insert(schema.customers)
      .values({
        companyId: session.companyId,
        firstName,
        lastName,
        email,
        phone: formattedPhone,
        alternatePhone: alternatePhone ? formatUKPhone(alternatePhone) : null,
        address,
        addressLine2: addressLine2 || null,
        city: city || null,
        postcode,
        country: country || "United Kingdom",
        customerType: customerType || "residential",
        status: status || "active",
        billingAddress: billingAddress || null,
        billingCity: billingCity || null,
        billingPostcode: billingPostcode || null,
        billingCountry: billingCountry || null,
        taxId: taxId || null,
        preferredContactMethod: preferredContactMethod || null,
        specialInstructions: specialInstructions || null,
        accessInstructions: accessInstructions || null,
        parkingInstructions: parkingInstructions || null,
        companyName: companyName || null,
        businessType: businessType || null,
        source: source || null,
        referredBy: referredBy || null,
        notes: notes || null,
      })
      .returning()

    console.log("Customer created successfully:", customer)

    if (Array.isArray(additionalAddresses) && additionalAddresses.length > 0) {
      try {
        await db.insert(schema.customerAddresses).values(
          additionalAddresses.map((addr: any) => ({
            customerId: customer.id,
            label: addr.label || null,
            address: addr.address,
            addressLine2: addr.addressLine2 || null,
            city: addr.city || null,
            postcode: addr.postcode || null,
            country: addr.country || null,
            accessInstructions: addr.accessInstructions || null,
            parkingInstructions: addr.parkingInstructions || null,
            specialInstructions: addr.specialInstructions || null,
            createdAt: new Date(),
          }))
        )
      } catch (addressError) {
        console.error("Failed to create additional addresses:", addressError)
      }
    }

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error("=== CREATE CUSTOMER ERROR ===")
    console.error("Error type:", error?.constructor?.name)
    console.error("Error message:", error instanceof Error ? error.message : error)
    console.error("Full error:", error)
    return createErrorResponse(error, "Failed to create customer")
  }
}


