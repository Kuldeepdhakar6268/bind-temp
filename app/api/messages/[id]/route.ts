import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/messages/[id]
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
    const messageId = parseInt(id)

    const message = await db.query.messages.findFirst({
      where: and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.companyId, session.companyId)
      ),
      with: {
        sender: true,
        job: true,
      },
    })

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Mark as read if viewing inbox message (use readAt column)
    if (!message.readAt && message.recipientId === session.id) {
      await db
        .update(schema.messages)
        .set({ readAt: new Date() })
        .where(eq(schema.messages.id, messageId))
    }

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error fetching message:", error)
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 })
  }
}

// PATCH /api/messages/[id] - Mark as read/unread
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
    const messageId = parseInt(id)
    const body = await request.json()

    const existing = await db.query.messages.findFirst({
      where: and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const updateData: any = {}
    
    // Mark as read/unread using readAt column
    if (body.markAsRead === true) {
      updateData.readAt = new Date()
    } else if (body.markAsRead === false) {
      updateData.readAt = null
    }
    
    if (body.status !== undefined) {
      updateData.status = body.status
    }

    const [updated] = await db
      .update(schema.messages)
      .set(updateData)
      .where(eq(schema.messages.id, messageId))
      .returning()

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating message:", error)
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
  }
}

// DELETE /api/messages/[id]
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
    const messageId = parseInt(id)

    const existing = await db.query.messages.findFirst({
      where: and(
        eq(schema.messages.id, messageId),
        eq(schema.messages.companyId, session.companyId)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    await db.delete(schema.messages).where(eq(schema.messages.id, messageId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }
}
