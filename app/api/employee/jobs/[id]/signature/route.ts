import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { customerSignatures, jobs, customers, jobAssignments } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

/**
 * GET /api/employee/jobs/[id]/signature
 * Get signature for a job
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

    // Get signature for this job
    const [signature] = await db
      .select()
      .from(customerSignatures)
      .where(eq(customerSignatures.jobId, jobId))
      .limit(1)

    return NextResponse.json({ signature: signature || null })
  } catch (error) {
    console.error("Error fetching signature:", error)
    return NextResponse.json({ error: "Failed to fetch signature" }, { status: 500 })
  }
}

/**
 * POST /api/employee/jobs/[id]/signature
 * Save customer signature for job completion
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

    const body = await request.json()
    const {
      signatureData, // Base64 encoded image
      signerName,
      signerEmail,
      rating,
      feedback,
      latitude,
      longitude,
      signedAddress,
      deviceType,
    } = body

    if (!signatureData) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 })
    }

    if (!signerName) {
      return NextResponse.json({ error: "Signer name is required" }, { status: 400 })
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
    const jobRecord = job.job

    // Check if signature already exists
    const [existingSignature] = await db
      .select()
      .from(customerSignatures)
      .where(eq(customerSignatures.jobId, jobId))
      .limit(1)

    if (existingSignature) {
      return NextResponse.json({ error: "Job already has a signature" }, { status: 400 })
    }

    // Get client IP
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0] : request.headers.get("x-real-ip") || null

    // Create signature record
    const [signature] = await db
      .insert(customerSignatures)
      .values({
        companyId: session.companyId,
        jobId,
        customerId: jobRecord.customerId,
        employeeId: session.id,
        signatureData,
        signerName,
        signerEmail: signerEmail || null,
        rating: rating || null,
        feedback: feedback || null,
        latitude: latitude || null,
        longitude: longitude || null,
        signedAddress: signedAddress || null,
        deviceType: deviceType || null,
        ipAddress,
        signedAt: new Date(),
      })
      .returning()

    return NextResponse.json({
      success: true,
      signature,
      message: "Signature saved successfully!",
    })
  } catch (error) {
    console.error("Error saving signature:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save signature" },
      { status: 500 }
    )
  }
}
