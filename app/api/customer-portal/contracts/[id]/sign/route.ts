import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { contracts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const customerId = getCustomerFromToken(request)
    const { id } = await params
    const contractId = parseInt(id)

    if (!contractId) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 })
    }

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.customerId, customerId)),
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    if (contract.status !== "draft") {
      return NextResponse.json({ error: "Only draft contracts can be signed" }, { status: 400 })
    }

    const [updated] = await db
      .update(contracts)
      .set({
        status: "active",
        signedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId))
      .returning()

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error signing contract:", error)

    if (error.message === "Unauthorized" || error.name === "JsonWebTokenError") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ error: "Failed to sign contract" }, { status: 500 })
  }
}
