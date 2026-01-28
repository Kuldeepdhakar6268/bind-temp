import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and } from "drizzle-orm"
import { unlink } from "fs/promises"
import path from "path"
import { UPLOAD_DIR } from "@/lib/file-storage"

// GET /api/attachments/[id] - Get a specific attachment
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const attachmentId = parseInt(id)

    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 })
    }

    const attachment = await db!.query.attachments.findFirst({
      where: and(eq(schema.attachments.id, attachmentId), eq(schema.attachments.companyId, session.companyId)),
    })

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    return NextResponse.json(attachment)
  } catch (error) {
    console.error("Get attachment error:", error)
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 500 })
  }
}

// DELETE /api/attachments/[id] - Delete an attachment
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const attachmentId = parseInt(id)

    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 })
    }

    // Get attachment to delete file from disk
    const attachment = await db!.query.attachments.findFirst({
      where: and(eq(schema.attachments.id, attachmentId), eq(schema.attachments.companyId, session.companyId)),
    })

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    // Delete from database
    await db!.delete(schema.attachments).where(eq(schema.attachments.id, attachmentId))

    // Delete file from disk
    try {
      const filePath = path.join(process.cwd(), "public", attachment.url)
      await unlink(filePath)

      // Delete thumbnail if exists
      if (attachment.thumbnailUrl) {
        const thumbnailPath = path.join(process.cwd(), "public", attachment.thumbnailUrl)
        await unlink(thumbnailPath).catch(() => {}) // Ignore errors if thumbnail doesn't exist
      }
    } catch (fileError) {
      console.error("Error deleting file from disk:", fileError)
      // Continue even if file deletion fails
    }

    return NextResponse.json({ message: "Attachment deleted successfully" })
  } catch (error) {
    console.error("Delete attachment error:", error)
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 })
  }
}

