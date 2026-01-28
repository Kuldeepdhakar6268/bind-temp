import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookingRequests, companies } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { verify } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET

/**
 * GET /api/customer-portal/bookings
 * Get booking requests for the logged-in customer
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

    // Fetch booking requests for this customer
    const results = await db
      .select({
        booking: bookingRequests,
        company: {
          id: companies.id,
          name: companies.name,
        },
      })
      .from(bookingRequests)
      .leftJoin(companies, eq(bookingRequests.companyId, companies.id))
      .where(eq(bookingRequests.customerId, decoded.customerId))
      .orderBy(desc(bookingRequests.createdAt))

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error fetching customer bookings:", error)
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}
