import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, ilike } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/service-areas - List service areas
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
    const isActive = searchParams.get("isActive")

    const conditions: any[] = [eq(schema.serviceAreas.companyId, session.companyId)]
    
    if (isActive === "true") conditions.push(eq(schema.serviceAreas.isActive, 1))
    if (isActive === "false") conditions.push(eq(schema.serviceAreas.isActive, 0))
    if (search) {
      conditions.push(ilike(schema.serviceAreas.name, `%${search}%`))
    }

    const areas = await db.query.serviceAreas.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.serviceAreas.createdAt)],
    })

    return NextResponse.json(areas)
  } catch (error) {
    console.error("Error fetching service areas:", error)
    return NextResponse.json({ error: "Failed to fetch service areas" }, { status: 500 })
  }
}

// POST /api/service-areas - Create service area
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
    const {
      name,
      description,
      postcodes,
      city,
      radius,
      surchargeAmount,
      surchargePercent,
      notes,
      isActive,
    } = body

    if (!name) {
      return NextResponse.json({ error: "Service area name is required" }, { status: 400 })
    }

    const [area] = await db
      .insert(schema.serviceAreas)
      .values({
        companyId: session.companyId,
        name,
        description: description || null,
        postcodes: postcodes ? JSON.stringify(postcodes) : null,
        city: city || null,
        radius: radius || null,
        surchargeAmount: surchargeAmount || null,
        surchargePercent: surchargePercent || null,
        isActive: isActive === undefined ? 1 : isActive ? 1 : 0,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return NextResponse.json(area, { status: 201 })
  } catch (error) {
    console.error("Error creating service area:", error)
    return NextResponse.json({ error: "Failed to create service area" }, { status: 500 })
  }
}

