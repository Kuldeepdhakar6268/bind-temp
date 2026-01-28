import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskVerificationPhotos } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"

/**
 * POST /api/photos/bulk-verify
 * Bulk verify or reject multiple photos at once
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { photoIds, status, rejectionReason } = body

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: "No photo IDs provided" }, { status: 400 })
    }

    if (!status || !["verified", "rejected", "pending"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Get all photos to verify they belong to this company
    const photos = await db
      .select()
      .from(taskVerificationPhotos)
      .where(inArray(taskVerificationPhotos.id, photoIds))

    // Filter to only photos belonging to this company
    const validPhotoIds = photos
      .filter(p => p.companyId === session.companyId)
      .map(p => p.id)

    if (validPhotoIds.length === 0) {
      return NextResponse.json({ error: "No valid photos found" }, { status: 404 })
    }

    // Update all valid photos
    const updateData: any = {
      verificationStatus: status,
      verifiedAt: status !== "pending" ? new Date() : null,
    }

    if (status === "rejected" && rejectionReason) {
      updateData.notes = rejectionReason
    }

    // Update each photo (Drizzle doesn't support bulk update with inArray returning)
    const updatedPhotos = await Promise.all(
      validPhotoIds.map(async (photoId) => {
        const [updated] = await db
          .update(taskVerificationPhotos)
          .set(updateData)
          .where(eq(taskVerificationPhotos.id, photoId))
          .returning()
        return updated
      })
    )

    return NextResponse.json({
      success: true,
      updatedCount: updatedPhotos.length,
      photos: updatedPhotos,
    })
  } catch (error) {
    console.error("Error bulk verifying photos:", error)
    return NextResponse.json({ error: "Failed to verify photos" }, { status: 500 })
  }
}
