import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskVerificationPhotos } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * PATCH /api/photos/[id]/verify
 * Verify or reject a verification photo
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const photoId = parseInt(id)

    if (isNaN(photoId)) {
      return NextResponse.json({ error: "Invalid photo ID" }, { status: 400 })
    }

    const body = await request.json()
    const { status, rejectionReason } = body

    if (!status || !["verified", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Get the photo to verify it belongs to this company
    const [photo] = await db
      .select()
      .from(taskVerificationPhotos)
      .where(eq(taskVerificationPhotos.id, photoId))
      .limit(1)

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 })
    }

    if (photo.companyId !== session.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Build update data
    const updateData: any = {
      verificationStatus: status,
      verifiedAt: status !== "pending" ? new Date() : null,
    }

    // Add rejection reason if provided
    if (status === "rejected" && rejectionReason) {
      updateData.notes = rejectionReason
    }

    // Update verification status
    const [updatedPhoto] = await db
      .update(taskVerificationPhotos)
      .set(updateData)
      .where(eq(taskVerificationPhotos.id, photoId))
      .returning()

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    })
  } catch (error) {
    console.error("Error verifying photo:", error)
    return NextResponse.json({ error: "Failed to verify photo" }, { status: 500 })
  }
}
