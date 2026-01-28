import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookingRequests, customers, companies } from "@/lib/db/schema"
import { eq, and, desc, sql } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"
import { sendBookingRequestAcknowledgmentEmail, sendNewBookingRequestToCompanyEmail } from "@/lib/email"

/**
 * GET /api/booking-requests
 * Get all booking requests for the company (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    
    const session = await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "50")

    let conditions = [eq(bookingRequests.companyId, session.companyId)]

    if (status && status !== "all") {
      conditions.push(eq(bookingRequests.status, status))
    }

    const results = await db
      .select({
        request: bookingRequests,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
        },
      })
      .from(bookingRequests)
      .leftJoin(customers, eq(bookingRequests.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(bookingRequests.createdAt))
      .limit(limit)

    // Transform results
    const formattedResults = results.map((r) => ({
      ...r.request,
      existingCustomer: r.customer,
    }))

    return NextResponse.json(formattedResults)
  } catch (error) {
    console.error("Error fetching booking requests:", error)
    return NextResponse.json(
      { error: "Failed to fetch booking requests" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/booking-requests
 * Submit a new booking request (public endpoint for customers)
 */
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    
    const body = await request.json()
    
    const {
      companyId,
      customerId,
      customerFirstName,
      customerLastName,
      customerEmail,
      customerPhone,
      address,
      addressLine2,
      city,
      postcode,
      accessInstructions,
      serviceType,
      propertyType,
      bedrooms,
      bathrooms,
      squareFootage,
      hasSpecialRequirements,
      specialRequirements,
      preferredDate,
      preferredTimeSlot,
      alternateDate,
      frequency,
      estimatedPrice,
      source,
      referralCode,
    } = body

    // Validate required fields
    if (!companyId || !customerFirstName || !customerLastName || !customerEmail || !address || !serviceType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify company exists
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    })

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      )
    }

    // Check if customer already exists by email, or create a new customer
    let existingCustomerId = customerId
    if (!existingCustomerId) {
      const existingCustomer = await db.query.customers.findFirst({
        where: and(
          eq(customers.companyId, companyId),
          eq(customers.email, customerEmail.toLowerCase())
        ),
      })
      if (existingCustomer) {
        existingCustomerId = existingCustomer.id
      } else {
        // Auto-create customer record so they can log in to the portal
        const [newCustomer] = await db
          .insert(customers)
          .values({
            companyId,
            firstName: customerFirstName,
            lastName: customerLastName,
            email: customerEmail.toLowerCase(),
            phone: customerPhone || null,
            address: address,
            addressLine2: addressLine2 || null,
            city: city || null,
            postcode: postcode || null,
            accessInstructions: accessInstructions || null,
            customerType: "residential",
            status: "active",
            source: source || "website",
          })
          .returning()
        existingCustomerId = newCustomer.id
        console.log(`Auto-created customer ${customerEmail} with ID ${newCustomer.id}`)
      }
    }

    // Create the booking request
    const [newRequest] = await db
      .insert(bookingRequests)
      .values({
        companyId,
        customerId: existingCustomerId,
        customerFirstName,
        customerLastName,
        customerEmail: customerEmail.toLowerCase(),
        customerPhone: customerPhone || null,
        address,
        addressLine2: addressLine2 || null,
        city: city || null,
        postcode: postcode || null,
        accessInstructions: accessInstructions || null,
        serviceType,
        propertyType: propertyType || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        squareFootage: squareFootage || null,
        hasSpecialRequirements: hasSpecialRequirements || 0,
        specialRequirements: specialRequirements || null,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTimeSlot: preferredTimeSlot || null,
        alternateDate: alternateDate ? new Date(alternateDate) : null,
        frequency: frequency || "one_time",
        estimatedPrice: estimatedPrice ? estimatedPrice.toString() : null,
        source: source || "website",
        referralCode: referralCode || null,
        status: "pending",
      })
      .returning()

    // Send acknowledgment email to customer
    try {
      await sendBookingRequestAcknowledgmentEmail({
        to: customerEmail,
        customerName: `${customerFirstName} ${customerLastName}`,
        serviceType,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
        preferredTimeSlot: preferredTimeSlot || null,
        address,
        city: city || null,
        postcode: postcode || null,
        estimatedPrice: estimatedPrice ? estimatedPrice.toString() : null,
        frequency: frequency || "one_time",
        companyName: company.name,
        companyEmail: company.email || null,
        companyPhone: company.phone || null,
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"}/portal`,
      })
      console.log(`Booking acknowledgment email sent to ${customerEmail}`)
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error("Failed to send booking acknowledgment email:", emailError)
    }

    // Send notification email to company
    if (company.email && isCompanyNotificationEnabled(company.notificationSettings, "bookingUpdates")) {
      try {
        await sendNewBookingRequestToCompanyEmail({
          companyEmail: company.email,
          companyName: company.name,
          customerName: `${customerFirstName} ${customerLastName}`,
          customerEmail: customerEmail.toLowerCase(),
          customerPhone: customerPhone || null,
          serviceType,
          preferredDate: preferredDate ? new Date(preferredDate) : null,
          preferredTimeSlot: preferredTimeSlot || null,
          address,
          city: city || null,
          postcode: postcode || null,
          estimatedPrice: estimatedPrice ? estimatedPrice.toString() : null,
          frequency: frequency || "one_time",
          specialRequirements: specialRequirements || null,
          bookingId: newRequest.id,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"}/booking-requests`,
        })
        console.log(`Booking notification email sent to company ${company.email}`)
      } catch (emailError) {
        console.error("Failed to send booking notification to company:", emailError)
      }
    }

    return NextResponse.json(newRequest, { status: 201 })
  } catch (error) {
    console.error("Error creating booking request:", error)
    return NextResponse.json(
      { error: "Failed to create booking request" },
      { status: 500 }
    )
  }
}
