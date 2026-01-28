import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { and, eq } from "drizzle-orm"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const employeeId = parseInt(id)
    if (isNaN(employeeId)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 })
    }

    const body = await request.json()
    const availability = body?.availability

    if (!availability || typeof availability !== "object") {
      return NextResponse.json({ error: "Availability data is required" }, { status: 400 })
    }

    const existingEmployee = await db.query.employees.findFirst({
      where: and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, session.companyId)),
    })

    if (!existingEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const [updated] = await db
      .update(schema.employees)
      .set({
        availability: JSON.stringify(availability),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.employees.id, employeeId), eq(schema.employees.companyId, session.companyId)))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update availability error:", error)
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 })
  }
}
