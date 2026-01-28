import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { sendJobAssignmentEmail, sendShiftSwapDecisionEmail } from "@/lib/email"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { id } = await params
    const swapId = parseInt(id)
    const body = await request.json()
    const status = body.status

    if (!swapId || (status !== "approved" && status !== "rejected")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const swap = await db.query.shiftSwapRequests.findFirst({
      where: and(
        eq(schema.shiftSwapRequests.id, swapId),
        eq(schema.shiftSwapRequests.companyId, session.companyId)
      ),
      with: {
        fromEmployee: true,
        toEmployee: true,
        fromJob: { with: { customer: true } },
        toJob: { with: { customer: true } },
      },
    })

    if (!swap) {
      return NextResponse.json({ error: "Swap request not found" }, { status: 404 })
    }

    if (swap.status !== "pending") {
      return NextResponse.json({ error: "Swap request already processed" }, { status: 400 })
    }

    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const formatJobTime = (job: typeof swap.fromJob) => {
      const date = job?.scheduledFor ? new Date(job.scheduledFor) : null
      const time = date ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "Time TBD"
      const day = date ? date.toLocaleDateString("en-GB") : "Date TBD"
      return `${day} ${time}`
    }

    if (status === "approved") {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.jobs)
          .set({
            assignedTo: swap.toEmployeeId,
            employeeAccepted: 0,
            employeeAcceptedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, swap.fromJobId))

        await tx
          .update(schema.jobs)
          .set({
            assignedTo: swap.fromEmployeeId,
            employeeAccepted: 0,
            employeeAcceptedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, swap.toJobId))

        await tx
          .update(schema.shiftSwapRequests)
          .set({ status: "approved", updatedAt: new Date() })
          .where(eq(schema.shiftSwapRequests.id, swapId))
      })

      if (swap.toEmployee?.email && swap.fromJob) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
          const fullAddress = [swap.fromJob.location, swap.fromJob.city, swap.fromJob.postcode].filter(Boolean).join(", ")
          
          await sendJobAssignmentEmail({
            employeeEmail: swap.toEmployee.email,
            employeeName: `${swap.toEmployee.firstName} ${swap.toEmployee.lastName}`,
            jobTitle: swap.fromJob.title,
            jobDescription: swap.fromJob.description || "",
            customerName: swap.fromJob.customer
              ? `${swap.fromJob.customer.firstName} ${swap.fromJob.customer.lastName}`
              : "Customer",
            customerPhone: swap.fromJob.customer?.phone || null,
            address: fullAddress,
            scheduledDate: swap.fromJob.scheduledFor ? new Date(swap.fromJob.scheduledFor) : new Date(),
            scheduledTime: swap.fromJob.scheduledFor ? new Date(swap.fromJob.scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
            estimatedDuration: swap.fromJob.durationMinutes ? `${swap.fromJob.durationMinutes} minutes` : null,
            specialInstructions: swap.fromJob.accessInstructions || null,
            companyName: company?.name || "Your Company",
            jobUrl: `${baseUrl}/employee/jobs/${swap.fromJobId}`,
          })
        } catch (emailError) {
          console.error("Failed to send assignment email:", emailError)
        }
      }

      if (swap.fromEmployee?.email && swap.toJob) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
          const fullAddress = [swap.toJob.location, swap.toJob.city, swap.toJob.postcode].filter(Boolean).join(", ")
          
          await sendJobAssignmentEmail({
            employeeEmail: swap.fromEmployee.email,
            employeeName: `${swap.fromEmployee.firstName} ${swap.fromEmployee.lastName}`,
            jobTitle: swap.toJob.title,
            jobDescription: swap.toJob.description || "",
            customerName: swap.toJob.customer
              ? `${swap.toJob.customer.firstName} ${swap.toJob.customer.lastName}`
              : "Customer",
            customerPhone: swap.toJob.customer?.phone || null,
            address: fullAddress,
            scheduledDate: swap.toJob.scheduledFor ? new Date(swap.toJob.scheduledFor) : new Date(),
            scheduledTime: swap.toJob.scheduledFor ? new Date(swap.toJob.scheduledFor).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
            estimatedDuration: swap.toJob.durationMinutes ? `${swap.toJob.durationMinutes} minutes` : null,
            specialInstructions: swap.toJob.accessInstructions || null,
            companyName: company?.name || "Your Company",
            jobUrl: `${baseUrl}/employee/jobs/${swap.toJobId}`,
          })
        } catch (emailError) {
          console.error("Failed to send assignment email:", emailError)
        }
      }

      if (swap.fromEmployee?.email && swap.toEmployee?.email) {
        try {
          await sendShiftSwapDecisionEmail({
            to: swap.fromEmployee.email,
            employeeName: `${swap.fromEmployee.firstName} ${swap.fromEmployee.lastName}`,
            companyName: company?.name || "Your Company",
            status: "approved",
            jobTitle: swap.toJob?.title || "New assignment",
            jobTime: swap.toJob ? formatJobTime(swap.toJob) : "Time TBD",
            otherEmployeeName: `${swap.toEmployee.firstName} ${swap.toEmployee.lastName}`,
          })

          await sendShiftSwapDecisionEmail({
            to: swap.toEmployee.email,
            employeeName: `${swap.toEmployee.firstName} ${swap.toEmployee.lastName}`,
            companyName: company?.name || "Your Company",
            status: "approved",
            jobTitle: swap.fromJob?.title || "New assignment",
            jobTime: swap.fromJob ? formatJobTime(swap.fromJob) : "Time TBD",
            otherEmployeeName: `${swap.fromEmployee.firstName} ${swap.fromEmployee.lastName}`,
          })
        } catch (emailError) {
          console.error("Failed to send swap decision email:", emailError)
        }
      }
    } else {
      await db
        .update(schema.shiftSwapRequests)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(schema.shiftSwapRequests.id, swapId))

      if (swap.fromEmployee?.email && swap.toEmployee?.email) {
        try {
          await sendShiftSwapDecisionEmail({
            to: swap.fromEmployee.email,
            employeeName: `${swap.fromEmployee.firstName} ${swap.fromEmployee.lastName}`,
            companyName: company?.name || "Your Company",
            status: "rejected",
            jobTitle: swap.fromJob?.title || "Current assignment",
            jobTime: swap.fromJob ? formatJobTime(swap.fromJob) : "Time TBD",
            otherEmployeeName: `${swap.toEmployee.firstName} ${swap.toEmployee.lastName}`,
          })

          await sendShiftSwapDecisionEmail({
            to: swap.toEmployee.email,
            employeeName: `${swap.toEmployee.firstName} ${swap.toEmployee.lastName}`,
            companyName: company?.name || "Your Company",
            status: "rejected",
            jobTitle: swap.toJob?.title || "Current assignment",
            jobTime: swap.toJob ? formatJobTime(swap.toJob) : "Time TBD",
            otherEmployeeName: `${swap.fromEmployee.firstName} ${swap.fromEmployee.lastName}`,
          })
        } catch (emailError) {
          console.error("Failed to send swap decision email:", emailError)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating shift swap:", error)
    return NextResponse.json({ error: "Failed to update shift swap" }, { status: 500 })
  }
}
