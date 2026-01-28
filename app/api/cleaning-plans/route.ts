import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, ilike } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/cleaning-plans - List cleaning plans
// Note: cleaningPlans table is global (no companyId), all companies share plans
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

    let whereCondition = undefined
    if (search) {
      whereCondition = ilike(schema.cleaningPlans.name, `%${search}%`)
    }

    const plans = await db.query.cleaningPlans.findMany({
      where: whereCondition,
      orderBy: [desc(schema.cleaningPlans.createdAt)],
      with: {
        tasks: true,
      },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error("Error fetching cleaning plans:", error)
    return NextResponse.json({ error: "Failed to fetch cleaning plans" }, { status: 500 })
  }
}

// POST /api/cleaning-plans - Create cleaning plan
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
    const { name, description, category, estimatedDuration, price, isActive, tasks } = body

    if (!name) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 })
    }

    const existing = await db.query.cleaningPlans.findFirst({
      where: ilike(schema.cleaningPlans.name, name),
    })

    if (existing) {
      return NextResponse.json({ error: "A cleaning plan with this name already exists" }, { status: 409 })
    }

    // Create the plan
    const [plan] = await db
      .insert(schema.cleaningPlans)
      .values({
        name,
        description: description || null,
        category: category || null,
        estimatedDuration: estimatedDuration || null,
        price: price || null,
        isActive: isActive === false ? 0 : 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    // Create tasks if provided
    if (tasks && tasks.length > 0) {
      // Check for duplicate task names
      const taskNames = tasks.map((t: any) => (t.title || t.name)?.toLowerCase().trim())
      const uniqueTaskNames = new Set(taskNames)
      if (taskNames.length !== uniqueTaskNames.size) {
        return NextResponse.json({ error: "Duplicate task names are not allowed within the same plan" }, { status: 400 })
      }

      await db.insert(schema.planTasks).values(
        tasks.map((task: any, index: number) => ({
          planId: plan.id,
          title: task.title || task.name,
          description: task.description || null,
          order: index,
          createdAt: new Date(),
        }))
      )
    }

    // Fetch the plan with tasks
    const planWithTasks = await db.query.cleaningPlans.findFirst({
      where: eq(schema.cleaningPlans.id, plan.id),
      with: {
        tasks: true,
      },
    })

    return NextResponse.json(planWithTasks, { status: 201 })
  } catch (error) {
    console.error("Error creating cleaning plan:", error)
    return NextResponse.json({ error: "Failed to create cleaning plan" }, { status: 500 })
  }
}

