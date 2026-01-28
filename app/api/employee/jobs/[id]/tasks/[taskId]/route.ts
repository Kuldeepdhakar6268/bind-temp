import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobs, jobTasks, jobCheckIns, jobAssignments } from "@/lib/db/schema"
import { eq, and, ne } from "drizzle-orm"
import { getEmployeeSession } from "@/lib/auth"

/**
 * PATCH /api/employee/jobs/[id]/tasks/[taskId]
 * Update a task status (complete/uncomplete)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getEmployeeSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, taskId } = await params
    const jobId = parseInt(id)
    const taskIdNum = parseInt(taskId)

    if (isNaN(jobId) || isNaN(taskIdNum)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    // Verify job belongs to employee
    const [existingJob] = await db
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

    if (!existingJob) {
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
        { error: "You must check in before updating tasks." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { completed, status } = body
    
    // Support both "completed" boolean and "status" string
    const isCompleted = completed === true || status === "completed"

    const [updatedTask] = await db
      .update(jobTasks)
      .set({
        status: isCompleted ? "completed" : "pending",
        completedBy: isCompleted ? session.id : null,
        completedAt: isCompleted ? new Date() : null,
      })
      .where(
        and(
          eq(jobTasks.id, taskIdNum),
          eq(jobTasks.jobId, jobId)
        )
      )
      .returning()

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}
