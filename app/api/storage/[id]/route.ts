import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/storage/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const attachmentId = parseInt(id)

    const attachment = await db.query.attachments.findFirst({
      where: and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.attachments.companyId, session.companyId)
      ),
    })

    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    return NextResponse.json(attachment)
  } catch (error) {
    console.error("Error fetching attachment:", error)
    return NextResponse.json({ error: "Failed to fetch attachment" }, { status: 500 })
  }
}

// PATCH /api/storage/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const attachmentId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.attachments.findFirst({
      where: and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.attachments.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const updateData: any = {}
    
    if (body.fileName !== undefined) updateData.fileName = body.fileName
    if (body.description !== undefined) updateData.description = body.description
    if (body.entityType !== undefined) updateData.entityType = body.entityType
    if (body.entityId !== undefined) updateData.entityId = body.entityId

    const [updated] = await db
      .update(schema.attachments)
      .set(updateData)
      .where(eq(schema.attachments.id, attachmentId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating attachment:", error)
    return NextResponse.json({ error: "Failed to update attachment" }, { status: 500 })
  }
}

// DELETE /api/storage/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const attachmentId = parseInt(id)

    const existing = await db.query.attachments.findFirst({
      where: and(
        eq(schema.attachments.id, attachmentId),
        eq(schema.attachments.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // TODO: Delete actual file from storage (Supabase, S3, etc.)
    
    await db.delete(schema.attachments).where(eq(schema.attachments.id, attachmentId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting attachment:", error)
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 })
  }
}
