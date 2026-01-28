import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { contracts, companies } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { verify } from "jsonwebtoken"

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

export async function GET(request: NextRequest) {
  try {
    const customerId = getCustomerFromToken(request)

    const customerContracts = await db
      .select({
        contract: contracts,
        company: companies,
      })
      .from(contracts)
      .leftJoin(companies, eq(contracts.companyId, companies.id))
      .where(eq(contracts.customerId, customerId))
      .orderBy(desc(contracts.createdAt))

    return NextResponse.json(customerContracts)
  } catch (error: any) {
    console.error("Error fetching customer contracts:", error)

    if (error.message === "Unauthorized" || error.name === "JsonWebTokenError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 })
  }
}
