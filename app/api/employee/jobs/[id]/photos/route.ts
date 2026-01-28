import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskVerificationPhotos, jobs, jobTasks, employees, jobCheckIns, jobAssignments } from "@/lib/db/schema"
import { eq, and, desc, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"
import { uploadToSupabaseStorage } from "@/lib/supabase"
import { validateFile } from "@/lib/file-storage"

/**
 * GET /api/employee/jobs/[id]/photos
 * Get all verification photos for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Verify job belongs to employee
    const [job] = await db
      .select({ job: jobs })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
        )
      )
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Get photos for this job
    const photos = await db
      .select()
      .from(taskVerificationPhotos)
      .where(eq(taskVerificationPhotos.jobId, jobId))
      .orderBy(desc(taskVerificationPhotos.capturedAt))

    return NextResponse.json(photos)
  } catch (error) {
    console.error("Error fetching photos:", error)
    return NextResponse.json({ error: "Failed to fetch photos" }, { status: 500 })
  }
}

/**
 * POST /api/employee/jobs/[id]/photos
 * Upload a verification photo with GPS data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("photo") as File | null
    const taskId = formData.get("taskId") as string | null
    const latitude = formData.get("latitude") as string | null
    const longitude = formData.get("longitude") as string | null
    const locationAccuracy = formData.get("locationAccuracy") as string | null
    const capturedAddress = formData.get("capturedAddress") as string | null
    const deviceType = formData.get("deviceType") as string | null
    const deviceModel = formData.get("deviceModel") as string | null
    const caption = formData.get("caption") as string | null

    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 })
    }

    // Verify job belongs to employee
    const [job] = await db
      .select({ job: jobs })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
      .where(
        and(
          eq(jobAssignments.jobId, jobId),
          eq(jobAssignments.employeeId, session.id),
          eq(jobAssignments.companyId, session.companyId),
          ne(jobAssignments.status, "declined"),
        )
      )
      .limit(1)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const hasCheckedIn = await db
      .select({ id: jobCheckIns.id })
      .from(jobCheckIns)
      .where(
        and(
          eq(jobCheckIns.jobId, jobId),
          eq(jobCheckIns.employeeId, session.id),
          eq(jobCheckIns.type, "check_in")
        )
      )
      .limit(1)

    if (hasCheckedIn.length === 0) {
      return NextResponse.json(
        { error: "You must check in before uploading photos." },
        { status: 403 }
      )
    }

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split(".").pop() || "jpg"
    const fileName = `job-${jobId}-${timestamp}.${extension}`
    const storagePath = `verification-photos/${session.companyId}/${fileName}`

    // Upload to Supabase Storage
    const { url } = await uploadToSupabaseStorage(file, "Cleaning Photos", storagePath)

    // Save to database with file URL
    const [photo] = await db
      .insert(taskVerificationPhotos)
      .values({
        companyId: session.companyId,
        jobId,
        taskId: taskId ? parseInt(taskId) : null,
        employeeId: session.id,
        fileName,
        originalName: file.name,
        url,
        thumbnailUrl: url,
        mimeType: file.type,
        sizeBytes: file.size,
        latitude: latitude || null,
        longitude: longitude || null,
        locationAccuracy: locationAccuracy || null,
        capturedAddress: capturedAddress || null,
        deviceType: deviceType || null,
        deviceModel: deviceModel || null,
        userAgent: request.headers.get("user-agent") || null,
        capturedAt: new Date(),
        verificationStatus: latitude && longitude ? "verified" : "pending",
        distanceFromJobSite: null,
        caption: caption || null,
      })
      .returning()

    return NextResponse.json({
      success: true,
      photo,
    })
  } catch (error) {
    console.error("Error uploading photo:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload photo" },
      { status: 500 }
    )
  }
}
