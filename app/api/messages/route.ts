import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, or, isNull, isNotNull, inArray } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendEmail } from "@/lib/email"

// GET /api/messages - List messages
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") // inbox, sent, all
    const isRead = searchParams.get("isRead")
    const jobId = searchParams.get("jobId")

    const conditions = [eq(schema.messages.companyId, session.companyId)]
    
    // Filter by inbox or sent
    if (type === "inbox") {
      conditions.push(
        or(
          eq(schema.messages.recipientId, session.id),
          eq(schema.messages.recipientType, "company")
        )!
      )
    } else if (type === "sent") {
      conditions.push(eq(schema.messages.senderId, session.id))
    }

    // Filter by read status using readAt column
    if (isRead === "true") conditions.push(isNotNull(schema.messages.readAt))
    if (isRead === "false") conditions.push(isNull(schema.messages.readAt))
    if (jobId) conditions.push(eq(schema.messages.jobId, parseInt(jobId)))

    const messagesList = await db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.messages.createdAt)],
      with: {
        sender: true,
        job: true,
      },
    })

    return NextResponse.json(messagesList)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

// POST /api/messages - Create/send message
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()
    const { subject, body: messageBody, recipientId, recipientIds, recipientType, messageType, jobId } = data

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 })
    }

    const normalizedRecipientType =
      recipientType === "all" ? "all" : recipientType === "employee" ? "employee" : "user"

    if (normalizedRecipientType === "employee" && !recipientId && (!Array.isArray(recipientIds) || recipientIds.length === 0)) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 })
    }

    let recipientEmails: string[] = []
    if (normalizedRecipientType === "all") {
      const employees = await db
        .select({ email: schema.employees.email })
        .from(schema.employees)
        .where(
          and(
            eq(schema.employees.companyId, session.companyId),
            eq(schema.employees.status, "active")
          )
        )
      recipientEmails = employees.map((employee) => employee.email).filter(Boolean)
    } else if (normalizedRecipientType === "employee") {
      const ids = Array.isArray(recipientIds) && recipientIds.length > 0
        ? recipientIds.map((id: string | number) => parseInt(String(id))).filter((id: number) => !isNaN(id))
        : [parseInt(recipientId)].filter((id: number) => !isNaN(id))
      const employees = await db
        .select({ id: schema.employees.id, email: schema.employees.email })
        .from(schema.employees)
        .where(
          and(
            eq(schema.employees.companyId, session.companyId),
            inArray(schema.employees.id, ids)
          )
        )
      recipientEmails = employees.map((employee) => employee.email).filter(Boolean)
    }

    if (messageType === "email") {
      if (recipientEmails.length === 0) {
        return NextResponse.json({ error: "No staff email addresses found" }, { status: 400 })
      }

      const subjectLine = subject || "New message from your company"
      const messageHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
          <h2 style="margin: 0 0 12px;">${subjectLine}</h2>
          <p style="white-space: pre-line;">${messageBody}</p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            Sent from ${session.company?.name || "your company"}
          </p>
        </div>
      `

      await Promise.all(
        recipientEmails.map((to) =>
          sendEmail({
            to,
            subject: subjectLine,
            html: messageHtml,
            text: messageBody,
          })
        )
      )
    }

    const [message] = await db
      .insert(schema.messages)
      .values({
        companyId: session.companyId,
        senderId: session.id,
        senderType: "user",
        recipientId: recipientId && !Array.isArray(recipientIds) ? parseInt(recipientId) : null,
        recipientType: normalizedRecipientType,
        subject: subject || null,
        body: messageBody,
        messageType: messageType || "internal",
        status: "sent",
        jobId: jobId ? parseInt(jobId) : null,
        sentAt: new Date(),
        createdAt: new Date(),
      })
      .returning()

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}

