import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/event-log - List job events
// Note: jobEvents are filtered via job.companyId relation
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
    const jobId = searchParams.get("jobId")
    const eventType = searchParams.get("eventType")
    const actorId = searchParams.get("actorId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = searchParams.get("limit")

    const conditions: any[] = []
    
    if (jobId) conditions.push(eq(schema.jobEvents.jobId, parseInt(jobId)))
    if (eventType) conditions.push(eq(schema.jobEvents.type, eventType))
    if (actorId) conditions.push(eq(schema.jobEvents.actorId, parseInt(actorId)))
    if (startDate) conditions.push(gte(schema.jobEvents.createdAt, new Date(startDate)))
    if (endDate) conditions.push(lte(schema.jobEvents.createdAt, new Date(endDate)))

    const events = await db.query.jobEvents.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.jobEvents.createdAt)],
      limit: limit ? parseInt(limit) : 100,
      with: {
        job: true,
        actor: true,
      },
    })

    // Filter to only show events for jobs belonging to the current company
    const filteredEvents = events.filter((e: any) => 
      e.job && !Array.isArray(e.job) && e.job.companyId === session.companyId
    )

    return NextResponse.json(filteredEvents)
  } catch (error) {
    console.error("Error fetching event log:", error)
    return NextResponse.json({ error: "Failed to fetch event log" }, { status: 500 })
  }
}

// POST /api/event-log - Create event
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
    const { jobId, type, actorId, message, meta } = body

    if (!jobId || !type) {
      return NextResponse.json({ error: "Job ID and event type are required" }, { status: 400 })
    }

    // Verify job belongs to the company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, parseInt(jobId)),
        eq(schema.jobs.companyId, session.companyId)
      ),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const [event] = await db
      .insert(schema.jobEvents)
      .values({
        jobId: parseInt(jobId),
        type,
        actorId: actorId ? parseInt(actorId) : null,
        message: message || null,
        meta: meta || null,
        createdAt: new Date(),
      })
      .returning()

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error("Error creating event:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

