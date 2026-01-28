import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { customers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verify } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET

/**
 * GET /api/customer-portal/profile
 * Get the full profile for the logged-in customer
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (!JWT_SECRET) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    // Verify token
    let decoded: any
    try {
      decoded = verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!decoded.customerId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Fetch customer profile
    const [customer] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        alternatePhone: customers.alternatePhone,
        address: customers.address,
        addressLine2: customers.addressLine2,
        city: customers.city,
        postcode: customers.postcode,
        country: customers.country,
        accessInstructions: customers.accessInstructions,
        parkingInstructions: customers.parkingInstructions,
        specialInstructions: customers.specialInstructions,
        preferredContactMethod: customers.preferredContactMethod,
      })
      .from(customers)
      .where(eq(customers.id, decoded.customerId))
      .limit(1)

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error("Error fetching customer profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/customer-portal/profile
 * Update the profile for the logged-in customer
 */
export async function PATCH(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (!JWT_SECRET) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    // Verify token
    let decoded: any
    try {
      decoded = verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!decoded.customerId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      alternatePhone,
      address,
      addressLine2,
      city,
      postcode,
      accessInstructions,
      parkingInstructions,
      specialInstructions,
      preferredContactMethod,
    } = body

    // Update customer profile
    const [updated] = await db
      .update(customers)
      .set({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        alternatePhone: alternatePhone || undefined,
        address: address || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        postcode: postcode || undefined,
        accessInstructions: accessInstructions || undefined,
        parkingInstructions: parkingInstructions || undefined,
        specialInstructions: specialInstructions || undefined,
        preferredContactMethod: preferredContactMethod || undefined,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, decoded.customerId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating customer profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
