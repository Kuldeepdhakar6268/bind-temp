import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, desc } from "drizzle-orm"

// GET /api/jobs/[id]/timeline - Get job activity timeline
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await requireAuth()
    const { id } = await params
    const jobId = parseInt(id)

    if (isNaN(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 })
    }

    // Verify job exists and belongs to company
    const job = await db.query.jobs.findFirst({
      where: and(
        eq(schema.jobs.id, jobId),
        eq(schema.jobs.companyId, session.companyId)
      ),
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Get all events for this job from jobEvents
    const events = await db.query.jobEvents.findMany({
      where: eq(schema.jobEvents.jobId, jobId),
      orderBy: [desc(schema.jobEvents.createdAt)],
    })

    // Get work sessions for this job
    const workSessions = await db.query.workSessions.findMany({
      where: eq(schema.workSessions.jobId, jobId),
      with: {
        employee: true,
      },
      orderBy: [desc(schema.workSessions.startedAt)],
    })

    // Get attachments for this job (instead of jobPhotos)
    const attachments = await db.query.attachments.findMany({
      where: and(
        eq(schema.attachments.jobId, jobId)
      ),
      orderBy: [desc(schema.attachments.createdAt)],
    })

    // Combine into unified timeline
    const timeline = [
      // Creation event
      {
        id: `created-${job.id}`,
        type: "created",
        description: `Job "${job.title}" was created`,
        timestamp: job.createdAt,
        icon: "plus",
      },
      // Events from jobEvents
      ...events.map((event) => ({
        id: `event-${event.id}`,
        type: event.type,
        description: event.message || "",
        timestamp: event.createdAt,
        metadata: event.meta ? JSON.parse(event.meta as string) : null,
        icon: getEventIcon(event.type || ""),
      })),
      // Work sessions
      ...workSessions.flatMap((session) => {
        const items: any[] = []
        const employee = session.employee as any
        if (session.startedAt) {
          items.push({
            id: `session-start-${session.id}`,
            type: "clock_in",
            description: `${employee?.firstName || "Employee"} started work`,
            timestamp: session.startedAt,
            icon: "clock",
          })
        }
        if (session.endedAt) {
          items.push({
            id: `session-end-${session.id}`,
            type: "clock_out",
            description: `${employee?.firstName || "Employee"} finished work`,
            timestamp: session.endedAt,
            metadata: {
              duration: session.durationMinutes,
            },
            icon: "clock",
          })
        }
        return items
      }),
      // Attachments (photos/files)
      ...attachments.map((attachment) => ({
        id: `attachment-${attachment.id}`,
        type: "attachment_added",
        description: `File added: ${attachment.fileName || "file"}`,
        timestamp: attachment.createdAt,
        metadata: {
          fileUrl: attachment.url,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
        },
        icon: "camera",
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      jobId,
      timeline,
      summary: {
        totalEvents: timeline.length,
        workSessions: workSessions.length,
        attachments: attachments.length,
      },
    })
  } catch (error) {
    console.error("Get job timeline error:", error)
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 })
  }
}

function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    created: "plus",
    assigned: "user",
    started: "play",
    completed: "check",
    cancelled: "x",
    rescheduled: "calendar",
    duplicated: "copy",
    confirmation_sent: "mail",
    reminder_sent: "bell",
    clock_in: "clock",
    clock_out: "clock",
    attachment_added: "camera",
  }
  return icons[eventType] || "circle"
}
