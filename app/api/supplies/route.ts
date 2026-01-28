import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, ilike, or } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/supplies - List supplies/inventory
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status")

    const conditions = [eq(schema.supplies.companyId, session.companyId)]
    
    if (category) conditions.push(eq(schema.supplies.category, category))
    if (status) conditions.push(eq(schema.supplies.status, status))
    if (search) {
      conditions.push(
        or(
          ilike(schema.supplies.name, `%${search}%`),
          ilike(schema.supplies.sku, `%${search}%`)
        )!
      )
    }

    const suppliesList = await db.query.supplies.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.supplies.createdAt)],
    })

    return NextResponse.json(suppliesList)
  } catch (error) {
    console.error("Error fetching supplies:", error)
    return NextResponse.json({ error: "Failed to fetch supplies" }, { status: 500 })
  }
}

// POST /api/supplies - Create supply item
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, sku, quantity, unit, minQuantity, unitCost, supplier, notes } = body

    if (!name) {
      return NextResponse.json({ error: "Supply name is required" }, { status: 400 })
    }

    const qty = Number.isFinite(Number(quantity)) ? Math.max(0, Number(quantity)) : 0
    const minQty = Number.isFinite(Number(minQuantity)) ? Math.max(0, Number(minQuantity)) : 5
    const normalizedUnitCost =
      typeof unitCost === "string" && unitCost.trim() === "" ? null : unitCost ?? null
    const normalizedSupplier =
      typeof supplier === "string" && supplier.trim() === "" ? null : supplier ?? null

    // Determine status based on quantity
    let status = "in-stock"
    if (qty === 0) {
      status = "out-of-stock"
    } else if (qty <= minQty) {
      status = "low-stock"
    }

    const [supply] = await db
      .insert(schema.supplies)
      .values({
        companyId: session.companyId,
        name,
        description: description || null,
        category: category || null,
        sku: sku || null,
        quantity: qty,
        unit: unit || null,
        minQuantity: minQty,
        unitCost: normalizedUnitCost,
        supplier: normalizedSupplier,
        status,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json(supply, { status: 201 })
  } catch (error) {
    console.error("Error creating supply:", error)
    return NextResponse.json({ error: "Failed to create supply" }, { status: 500 })
  }
}
