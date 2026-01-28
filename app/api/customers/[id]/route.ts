import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, ne } from "drizzle-orm"
import { createErrorResponse, createConflictError, createValidationError } from "@/lib/api-errors"
import { formatUKPhone } from "@/lib/phone-validation"
import { sendCustomerDeactivatedEmail, sendCustomerReactivatedEmail } from "@/lib/email"

async function notifyCustomerStatusChange(params: {
  customer: { firstName: string; lastName: string; email: string }
  company: { name?: string | null; email?: string | null; phone?: string | null } | null
  previousStatus: string | null
  nextStatus: string | null
}) {
  const { customer, company, previousStatus, nextStatus } = params

  if (!customer?.email) return

  const normalizedPrev = previousStatus || "active"
  const normalizedNext = nextStatus || normalizedPrev

  if (normalizedPrev === normalizedNext) return

  const customerName = `${customer.firstName} ${customer.lastName}`.trim() || customer.email
  const companyName = company?.name || "Your Cleaning Company"
  const companyEmail = company?.email || null
  const companyPhone = company?.phone || null

  try {
    if (normalizedNext === "inactive") {
      await sendCustomerDeactivatedEmail({
        customerEmail: customer.email,
        customerName,
        companyName,
        companyEmail,
        companyPhone,
      })
      return
    }

    if (normalizedNext === "active" && normalizedPrev === "inactive") {
      await sendCustomerReactivatedEmail({
        customerEmail: customer.email,
        customerName,
        companyName,
        companyEmail,
        companyPhone,
      })
    }
  } catch (error) {
    console.error("Failed to send customer status email:", error)
  }
}

// GET /api/customers/[id] - Get a specific customer
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 })
    }

    const customer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.id, customerId),
        eq(schema.customers.companyId, session.companyId),
      ),
      with: {
        addresses: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Return customer with computed name field for backwards compatibility
    return NextResponse.json({
      ...customer,
      name: `${customer.firstName} ${customer.lastName}`.trim(),
    })
  } catch (error) {
    console.error("Get customer error:", error)
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 })
  }
}

// PUT /api/customers/[id] - Update a customer
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 })
    }

    // Verify customer belongs to this company
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.id, customerId),
        eq(schema.customers.companyId, session.companyId),
      ),
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const body = await request.json()

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
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 },
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Check for duplicate email (excluding current customer)
    const duplicateEmail = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.companyId, session.companyId),
        eq(schema.customers.email, email),
        ne(schema.customers.id, customerId)
      ),
    })

    if (duplicateEmail) {
      return createConflictError("A customer with this email already exists in your company")
    }

    // Check for duplicate phone (excluding current customer)
    if (phone) {
      const formattedPhone = formatUKPhone(phone)
      const duplicatePhone = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.companyId, session.companyId),
          eq(schema.customers.phone, formattedPhone),
          ne(schema.customers.id, customerId)
        ),
      })

      if (duplicatePhone) {
        return createConflictError("A customer with this phone number already exists in your company")
      }
    }

    const previousStatus = existingCustomer.status || "active"
    const nextStatus = typeof status === "string" && status.length > 0 ? status : previousStatus

    // Update customer
    const [updatedCustomer] = await db
      .update(schema.customers)
      .set({
        firstName,
        lastName,
        email,
        phone: phone ? formatUKPhone(phone) : null,
        alternatePhone: alternatePhone ? formatUKPhone(alternatePhone) : null,
        address: address || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        country: country || "UK",
        customerType: customerType || "residential",
        status: nextStatus,
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
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, customerId))
      .returning()

    // Handle additional addresses if provided
    if (Array.isArray(additionalAddresses)) {
      // Get existing address IDs
      const existingAddresses = await db.query.customerAddresses.findMany({
        where: eq(schema.customerAddresses.customerId, customerId),
      })
      const existingIds = new Set(existingAddresses.map((a) => a.id))
      const incomingIds = new Set(
        additionalAddresses.filter((a: any) => a.id).map((a: any) => a.id)
      )

      // Delete addresses that are no longer in the list
      for (const existing of existingAddresses) {
        if (!incomingIds.has(existing.id)) {
          await db.delete(schema.customerAddresses).where(eq(schema.customerAddresses.id, existing.id))
        }
      }

      // Update existing and insert new addresses
      for (const addr of additionalAddresses) {
        if (addr.id && existingIds.has(addr.id)) {
          // Update existing
          await db
            .update(schema.customerAddresses)
            .set({
              label: addr.label || null,
              address: addr.address,
              addressLine2: addr.addressLine2 || null,
              city: addr.city || null,
              postcode: addr.postcode || null,
              country: addr.country || null,
              accessInstructions: addr.accessInstructions ?? null,
              parkingInstructions: addr.parkingInstructions ?? null,
              specialInstructions: addr.specialInstructions ?? null,
            })
            .where(eq(schema.customerAddresses.id, addr.id))
        } else {
          // Insert new
          await db.insert(schema.customerAddresses).values({
            customerId,
            label: addr.label || null,
            address: addr.address,
            addressLine2: addr.addressLine2 || null,
            city: addr.city || null,
            postcode: addr.postcode || null,
            country: addr.country || null,
            accessInstructions: addr.accessInstructions ?? null,
            parkingInstructions: addr.parkingInstructions ?? null,
            specialInstructions: addr.specialInstructions ?? null,
            createdAt: new Date(),
          })
        }
      }
    }

    if (previousStatus !== nextStatus) {
      const company = await db.query.companies.findFirst({
        where: eq(schema.companies.id, session.companyId),
      })

      await notifyCustomerStatusChange({
        customer: updatedCustomer,
        company,
        previousStatus,
        nextStatus,
      })
    }

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error("Update customer error:", error)
    return createErrorResponse(error, "Failed to update customer")
  }
}

// PATCH /api/customers/[id] - Update customer status only
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const nextStatus = typeof body?.status === "string" ? body.status : null

    if (!nextStatus || !["active", "inactive"].includes(nextStatus)) {
      return createValidationError("Status must be 'active' or 'inactive'")
    }

    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.id, customerId),
        eq(schema.customers.companyId, session.companyId),
      ),
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const previousStatus = existingCustomer.status || "active"

    if (previousStatus === nextStatus) {
      return NextResponse.json(existingCustomer)
    }

    const [updatedCustomer] = await db
      .update(schema.customers)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, customerId))
      .returning()

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    await notifyCustomerStatusChange({
      customer: updatedCustomer,
      company,
      previousStatus,
      nextStatus,
    })

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error("Update customer status error:", error)
    return createErrorResponse(error, "Failed to update customer status")
  }
}

// DELETE /api/customers/[id] - Deactivate a customer
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 })
    }

    // Verify customer belongs to this company
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.id, customerId),
        eq(schema.customers.companyId, session.companyId),
      ),
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    const previousStatus = existingCustomer.status || "active"
    const nextStatus = "inactive"

    if (previousStatus === nextStatus) {
      return NextResponse.json({
        success: true,
        message: "Customer already inactive",
        customer: existingCustomer,
      })
    }

    const [updatedCustomer] = await db
      .update(schema.customers)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, customerId))
      .returning()

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    await notifyCustomerStatusChange({
      customer: updatedCustomer,
      company,
      previousStatus,
      nextStatus,
    })

    return NextResponse.json({
      success: true,
      message: "Customer deactivated successfully",
      customer: updatedCustomer,
    })
  } catch (error) {
    console.error("Deactivate customer error:", error)
    return NextResponse.json({ error: "Failed to deactivate customer" }, { status: 500 })
  }
}

