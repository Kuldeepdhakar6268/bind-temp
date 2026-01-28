import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { eq, and, desc } from "drizzle-orm"

// GET /api/attachments - Get attachments with optional filtering
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)

    const jobId = searchParams.get("jobId")
    const customerId = searchParams.get("customerId")
    const employeeId = searchParams.get("employeeId")
    const invoiceId = searchParams.get("invoiceId")
    const category = searchParams.get("category")
    const fileType = searchParams.get("fileType")

    const conditions = [eq(schema.attachments.companyId, session.companyId)]

    if (jobId) {
      conditions.push(eq(schema.attachments.jobId, parseInt(jobId)))
    }

    if (customerId) {
      conditions.push(eq(schema.attachments.customerId, parseInt(customerId)))
    }

    if (employeeId) {
      conditions.push(eq(schema.attachments.employeeId, parseInt(employeeId)))
    }

    if (invoiceId) {
      conditions.push(eq(schema.attachments.invoiceId, parseInt(invoiceId)))
    }

    if (category) {
      conditions.push(eq(schema.attachments.category, category))
    }

    if (fileType) {
      conditions.push(eq(schema.attachments.fileType, fileType))
    }

    const attachments = await db!.query.attachments.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.attachments.createdAt)],
    })

    return NextResponse.json(attachments)
  } catch (error) {
    console.error("Get attachments error:", error)
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 })
  }
}


