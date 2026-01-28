import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, isNotNull } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/feedback - List customer feedback from jobs
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
    const customerId = searchParams.get("customerId")
    const minRating = searchParams.get("minRating")
    const maxRating = searchParams.get("maxRating")

    // Get jobs with feedback
    const conditions = [
      eq(schema.jobs.companyId, session.companyId),
      isNotNull(schema.jobs.customerFeedback),
    ]
    
    if (customerId) conditions.push(eq(schema.jobs.customerId, parseInt(customerId)))

    const jobsWithFeedback = await db.query.jobs.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.jobs.completedAt)],
      with: {
        customer: true,
        assignee: true,
      },
    })

    // Filter by rating if specified
    let filtered = jobsWithFeedback
    if (minRating) {
      const min = parseFloat(minRating)
      filtered = filtered.filter(j => j.qualityRating && parseFloat(j.qualityRating) >= min)
    }
    if (maxRating) {
      const max = parseFloat(maxRating)
      filtered = filtered.filter(j => j.qualityRating && parseFloat(j.qualityRating) <= max)
    }

    // Format response
    const feedback = filtered.map(job => ({
      id: job.id,
      jobId: job.id,
      jobTitle: job.title,
      customer: job.customer ? {
        id: job.customer.id,
        name: job.customer.name,
      } : null,
      assignee: job.assignee ? {
        id: job.assignee.id,
        name: `${job.assignee.firstName} ${job.assignee.lastName}`,
      } : null,
      rating: job.qualityRating,
      feedback: job.customerFeedback,
      completedAt: job.completedAt,
    }))

    // Calculate summary
    const ratings = feedback.filter(f => f.rating).map(f => parseFloat(f.rating!))
    const averageRating = ratings.length > 0 
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
      : null

    return NextResponse.json({
      feedback,
      summary: {
        totalFeedback: feedback.length,
        averageRating,
        ratingDistribution: {
          excellent: ratings.filter(r => r >= 4.5).length,
          good: ratings.filter(r => r >= 3.5 && r < 4.5).length,
          average: ratings.filter(r => r >= 2.5 && r < 3.5).length,
          poor: ratings.filter(r => r < 2.5).length,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching feedback:", error)
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 })
  }
}

// POST /api/feedback - Add feedback to a job
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
    const { jobId, rating, feedback } = body

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Verify job belongs to company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, parseInt(jobId)),
        eq(schema.jobs.companyId, session.companyId)
      ),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }
    if (rating !== undefined) updateData.qualityRating = rating.toString()
    if (feedback !== undefined) updateData.customerFeedback = feedback

    const [updated] = await db
      .update(schema.jobs)
      .set(updateData)
      .where(eq(schema.jobs.id, parseInt(jobId)))
      .returning()

    return NextResponse.json({
      jobId: updated.id,
      rating: updated.qualityRating,
      feedback: updated.customerFeedback,
    })
  } catch (error) {
    console.error("Error adding feedback:", error)
    return NextResponse.json({ error: "Failed to add feedback" }, { status: 500 })
  }
}

