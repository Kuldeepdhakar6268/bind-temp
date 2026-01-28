import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, taskVerificationPhotos, employees } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { verify } from "jsonwebtoken"

const JWT_SECRET = process.env.NEXTAUTH_SECRET

/**
 * GET /api/customer-portal/jobs/[id]/photos
 * Get photos for a specific job (customer must own the job)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Verify the job belongs to this customer
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.id, jobId),
        eq(jobs.customerId, decoded.customerId)
      ),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Get all photos for this job
    const photos = await db
      .select({
        id: taskVerificationPhotos.id,
        url: taskVerificationPhotos.url,
        thumbnailUrl: taskVerificationPhotos.thumbnailUrl,
        caption: taskVerificationPhotos.caption,
        capturedAt: taskVerificationPhotos.capturedAt,
        uploadedAt: taskVerificationPhotos.uploadedAt,
        employeeId: taskVerificationPhotos.employeeId,
        verificationStatus: taskVerificationPhotos.verificationStatus,
      })
      .from(taskVerificationPhotos)
      .where(eq(taskVerificationPhotos.jobId, jobId))

    // Get employee names for photos
    const photosWithUploader = await Promise.all(
      photos.map(async (photo) => {
        let uploaderName = null
        if (photo.employeeId) {
          const employee = await db!.query.employees.findFirst({
            where: eq(employees.id, photo.employeeId),
            columns: { firstName: true, lastName: true }
          })
          if (employee) {
            uploaderName = `${employee.firstName} ${employee.lastName}`
          }
        }
        return {
          id: photo.id,
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
          type: null, // taskVerificationPhotos doesn't have type field, we'll determine from context
          caption: photo.caption,
          roomArea: null,
          takenAt: photo.capturedAt,
          uploaderName,
        }
      })
    )

    // Group photos by type (before/after)
    const beforePhotos = photosWithUploader.filter(p => p.type === "before")
    const afterPhotos = photosWithUploader.filter(p => p.type === "after")
    const otherPhotos = photosWithUploader.filter(p => !["before", "after"].includes(p.type || ""))

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        scheduledFor: job.scheduledFor,
        location: job.location,
      },
      photos: {
        before: beforePhotos,
        after: afterPhotos,
        other: otherPhotos,
        all: photosWithUploader,
        total: photos.length,
      },
    })
  } catch (error) {
    console.error("Error fetching job photos:", error)
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    )
  }
}
