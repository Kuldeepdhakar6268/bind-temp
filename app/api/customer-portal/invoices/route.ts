import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoiceItems, companies } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { verify } from "jsonwebtoken"

// SECURITY: JWT_SECRET must be set in environment - no fallback allowed
const JWT_SECRET = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) {
  console.error("CRITICAL: NEXTAUTH_SECRET is not set!")
}

function getCustomerFromToken(request: NextRequest) {
  if (!JWT_SECRET) {
    throw new Error("Server configuration error")
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized")
  }

  const token = authHeader.substring(7)
  const decoded = verify(token, JWT_SECRET) as { customerId: number; type: string }

  if (decoded.type !== "customer") {
    throw new Error("Invalid token type")
  }

  return decoded.customerId
}

// GET /api/customer-portal/invoices - Get customer's invoices
export async function GET(request: NextRequest) {
  try {
    const customerId = getCustomerFromToken(request)

    // Get all invoices for this customer
    const customerInvoices = await db
      .select({
        invoice: invoices,
        company: companies,
      })
      .from(invoices)
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(eq(invoices.customerId, customerId))
      .orderBy(desc(invoices.createdAt))

    return NextResponse.json(customerInvoices)
  } catch (error: any) {
    console.error("Error fetching customer invoices:", error)
    
    if (error.message === "Unauthorized" || error.name === "JsonWebTokenError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}


