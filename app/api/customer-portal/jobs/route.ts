import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, taskVerificationPhotos, customers, employees } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { verify } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET

/**
 * GET /api/customer-portal/jobs
 * Get jobs for the logged-in customer
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    if (!JWT_SECRET) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")

    // Verify token
    let decoded: any
    try {
      decoded = verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!decoded.customerId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Fetch jobs for this customer
    const customerJobs = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        status: jobs.status,
        scheduledFor: jobs.scheduledFor,
        scheduledEnd: jobs.scheduledEnd,
        location: jobs.location,
        city: jobs.city,
        estimatedPrice: jobs.estimatedPrice,
        currency: jobs.currency,
        durationMinutes: jobs.durationMinutes,
        assigneeId: jobs.assigneeId,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(eq(jobs.customerId, decoded.customerId))
      .orderBy(desc(jobs.scheduledFor))

    // Get employee names for assigned jobs
    const jobsWithDetails = await Promise.all(
      customerJobs.map(async (job) => {
        let assigneeName = null
        if (job.assigneeId && db) {
          const employee = await db.query.employees.findFirst({
            where: eq(employees.id, job.assigneeId),
            columns: { firstName: true, lastName: true }
          })
          if (employee) {
            assigneeName = `${employee.firstName} ${employee.lastName}`
          }
        }

        // Get photo count for this job
        const photos = db ? await db
          .select({ id: taskVerificationPhotos.id })
          .from(taskVerificationPhotos)
          .where(eq(taskVerificationPhotos.jobId, job.id)) : []

        return {
          ...job,
          assigneeName,
          photoCount: photos.length,
        }
      })
    )

    return NextResponse.json(jobsWithDetails)
  } catch (error) {
    console.error("Error fetching customer jobs:", error)
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    )
  }
}
