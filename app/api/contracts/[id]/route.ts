import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/contracts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contractId = parseInt(id)

    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(schema.contracts.id, contractId),
        eq(schema.contracts.companyId, session.companyId)
      ),
      with: {
        customer: true,
      },
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    return NextResponse.json(contract)
  } catch (error) {
    console.error("Error fetching contract:", error)
    return NextResponse.json({ error: "Failed to fetch contract" }, { status: 500 })
  }
}

// PATCH /api/contracts/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contractId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.contracts.findFirst({
      where: and(
        eq(schema.contracts.id, contractId),
        eq(schema.contracts.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.frequency !== undefined) updateData.frequency = body.frequency
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.autoRenew !== undefined) updateData.autoRenew = body.autoRenew ? 1 : 0
    if (body.amount !== undefined) updateData.amount = body.amount.toString()
    if (body.billingFrequency !== undefined) updateData.billingFrequency = body.billingFrequency
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.terms !== undefined) updateData.terms = body.terms
    // New fields
    if (body.scheduleDays !== undefined) updateData.scheduleDays = body.scheduleDays
    if (body.hoursPerWeek !== undefined) updateData.hoursPerWeek = body.hoursPerWeek ? body.hoursPerWeek.toString() : null
    if (body.hourlyRate !== undefined) updateData.hourlyRate = body.hourlyRate ? body.hourlyRate.toString() : null
    if (body.annualValue !== undefined) updateData.annualValue = body.annualValue ? body.annualValue.toString() : null
    if (body.employeeIds !== undefined) {
      const parsedEmployeeIds = Array.isArray(body.employeeIds)
        ? body.employeeIds
            .map((id: unknown) => parseInt(String(id)))
            .filter((id: number) => Number.isFinite(id))
        : []
      const validEmployeeIds = parsedEmployeeIds.length
        ? (
            await db.query.employees.findMany({
              where: and(
                eq(schema.employees.companyId, session.companyId),
                inArray(schema.employees.id, parsedEmployeeIds)
              ),
              columns: { id: true },
            })
          ).map((employee) => employee.id)
        : []
      updateData.employeeIds = validEmployeeIds
    }
    
    if (body.status === "active" && !existing.signedAt) {
      updateData.signedAt = new Date()
    }
    if (body.status === "cancelled" && !existing.cancelledAt) {
      updateData.cancelledAt = new Date()
    }

    const startDate = updateData.startDate ?? existing.startDate
    const endDate = updateData.endDate ?? existing.endDate
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: "End date cannot be before start date" }, { status: 400 })
    }
    if (endDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (endDate < today) {
        return NextResponse.json({ error: "End date cannot be in the past" }, { status: 400 })
      }
    }

    const [updated] = await db
      .update(schema.contracts)
      .set(updateData)
      .where(eq(schema.contracts.id, contractId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating contract:", error)
    return NextResponse.json({ error: "Failed to update contract" }, { status: 500 })
  }
}

// DELETE /api/contracts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contractId = parseInt(id)

    const existing = await db.query.contracts.findFirst({
      where: and(
        eq(schema.contracts.id, contractId),
        eq(schema.contracts.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    await db.delete(schema.contracts).where(eq(schema.contracts.id, contractId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contract:", error)
    return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 })
  }
}
