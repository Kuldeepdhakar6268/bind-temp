import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskVerificationPhotos, jobs, employees, jobTasks } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * GET /api/photos
 * Get verification photos for the company
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status") // pending, verified, rejected

    const conditions = [eq(taskVerificationPhotos.companyId, session.companyId)]
    
    if (status) {
      conditions.push(eq(taskVerificationPhotos.verificationStatus, status))
    }

    const photos = await db
      .select({
        id: taskVerificationPhotos.id,
        photoUrl: taskVerificationPhotos.photoUrl,
        capturedAt: taskVerificationPhotos.capturedAt,
        verificationStatus: taskVerificationPhotos.verificationStatus,
        verifiedAt: taskVerificationPhotos.verifiedAt,
        gpsLatitude: taskVerificationPhotos.gpsLatitude,
        gpsLongitude: taskVerificationPhotos.gpsLongitude,
        jobId: taskVerificationPhotos.jobId,
        taskId: taskVerificationPhotos.taskId,
        employeeId: taskVerificationPhotos.employeeId,
        job: {
          id: jobs.id,
          title: jobs.title,
          location: jobs.location,
        },
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
        },
      })
      .from(taskVerificationPhotos)
      .leftJoin(jobs, eq(taskVerificationPhotos.jobId, jobs.id))
      .leftJoin(employees, eq(taskVerificationPhotos.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(taskVerificationPhotos.capturedAt))
      .limit(limit)

    return NextResponse.json(photos)
  } catch (error) {
    console.error("Error fetching photos:", error)
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 })
  }
}
