import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, ne, and, ilike } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/cleaning-plans/[id]
// Note: cleaningPlans are global (no companyId)
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
    const planId = parseInt(id)

    const plan = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, planId),
      with: {
        tasks: true,
      },
    })

    if (!plan) {
      return NextResponse.json({ error: "Cleaning plan not found" }, { status: 404 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error("Error fetching cleaning plan:", error)
    return NextResponse.json({ error: "Failed to fetch cleaning plan" }, { status: 500 })
  }
}

// PATCH /api/cleaning-plans/[id]
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
    const planId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, planId),
    })

    if (!existing) {
      return NextResponse.json({ error: "Cleaning plan not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    
    if (body.name !== undefined) {
      const duplicate = await db.query.cleaningPlans.findFirst({
        where: and(
          ilike(schema.cleaningPlans.name, body.name),
          ne(schema.cleaningPlans.id, planId)
        ),
      })

      if (duplicate) {
        return NextResponse.json({ error: "A cleaning plan with this name already exists" }, { status: 409 })
      }

      updateData.name = body.name
    }
    if (body.description !== undefined) updateData.description = body.description
    if (body.category !== undefined) updateData.category = body.category
    if (body.estimatedDuration !== undefined) updateData.estimatedDuration = body.estimatedDuration
    if (body.price !== undefined) updateData.price = body.price
    if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0

    const [updated] = await db
      .update(schema.cleaningPlans)
      .set(updateData)
      .where(eq(schema.cleaningPlans.id, planId))
      .returning()

    // Update tasks if provided
    if (body.tasks !== undefined) {
      // Check for duplicate task names
      if (body.tasks.length > 0) {
        const taskNames = body.tasks.map((t: any) => (t.title || t.name)?.toLowerCase().trim())
        const uniqueTaskNames = new Set(taskNames)
        if (taskNames.length !== uniqueTaskNames.size) {
          return NextResponse.json({ error: "Duplicate task names are not allowed within the same plan" }, { status: 400 })
        }
      }

      // Delete existing tasks
      await db.delete(schema.planTasks).where(eq(schema.planTasks.planId, planId))
      
      // Create new tasks
      if (body.tasks.length > 0) {
        await db.insert(schema.planTasks).values(
          body.tasks.map((task: any, index: number) => ({
            planId: planId,
            title: task.title || task.name,
            description: task.description || null,
            order: index,
            createdAt: new Date(),
          }))
        )
      }
    }

    // Fetch updated plan with tasks
    const planWithTasks = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, planId),
      with: {
        tasks: true,
      },
    })

    return NextResponse.json(planWithTasks)
  } catch (error) {
    console.error("Error updating cleaning plan:", error)
    return NextResponse.json({ error: "Failed to update cleaning plan" }, { status: 500 })
  }
}

// DELETE /api/cleaning-plans/[id]
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
    const planId = parseInt(id)

    const existing = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, planId),
    })

    if (!existing) {
      return NextResponse.json({ error: "Cleaning plan not found" }, { status: 404 })
    }

    // Tasks will be deleted automatically due to cascade
    await db.delete(schema.cleaningPlans).where(eq(schema.cleaningPlans.id, planId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting cleaning plan:", error)
    return NextResponse.json({ error: "Failed to delete cleaning plan" }, { status: 500 })
  }
}
