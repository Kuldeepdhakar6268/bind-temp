import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, ilike, or } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/equipment - List equipment
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
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const assignedTo = searchParams.get("assignedTo")

    const conditions = [eq(schema.equipment.companyId, session.companyId)]
    
    if (status) conditions.push(eq(schema.equipment.status, status))
    if (category) conditions.push(eq(schema.equipment.category, category))
    if (assignedTo) conditions.push(eq(schema.equipment.assignedTo, parseInt(assignedTo)))
    if (search) {
      conditions.push(
        or(
          ilike(schema.equipment.name, `%${search}%`),
          ilike(schema.equipment.serialNumber, `%${search}%`)
        )!
      )
    }

    const equipmentList = await db.query.equipment.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.equipment.createdAt)],
      with: {
        assignedEmployee: true,
      },
    })

    return NextResponse.json(equipmentList)
  } catch (error) {
    console.error("Error fetching equipment:", error)
    return NextResponse.json({ error: "Failed to fetch equipment" }, { status: 500 })
  }
}

// POST /api/equipment - Create equipment
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
    const { name, category, serialNumber, purchaseDate, purchasePrice, warrantyExpires, assignedTo, notes } = body

    if (!name) {
      return NextResponse.json({ error: "Equipment name is required" }, { status: 400 })
    }

    // Validate assignedTo employee belongs to the company
    if (assignedTo) {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(schema.employees.id, parseInt(assignedTo)),
          eq(schema.employees.companyId, session.companyId)
        ),
      })

      if (!employee) {
        return NextResponse.json(
          { error: "Assigned employee not found or does not belong to this company" },
          { status: 400 }
        )
      }
    }

    const [equipment] = await db
      .insert(schema.equipment)
      .values({
        companyId: session.companyId,
        name,
        category: category || null,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        purchasePrice: purchasePrice || null,
        warrantyExpires: warrantyExpires ? new Date(warrantyExpires) : null,
        status: "available",
        assignedTo: assignedTo ? parseInt(assignedTo) : null,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    console.error("Error creating equipment:", error)
    return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 })
  }
}

