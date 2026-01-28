import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db, schema } from "@/lib/db"
import { saveFile, validateFile, getFileType } from "@/lib/file-storage"

// POST /api/upload - Upload a file
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const formData = await request.formData()

    const file = formData.get("file") as File
    const category = (formData.get("category") as string) || "jobs"
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const jobId = formData.get("jobId") as string
    const customerId = formData.get("customerId") as string
    const employeeId = formData.get("employeeId") as string
    const invoiceId = formData.get("invoiceId") as string
    const tags = formData.get("tags") as string

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Save file to disk
    const { fileName, url, thumbnailUrl } = await saveFile(file, category)

    // Save to database
    const [attachment] = await db!
      .insert(schema.attachments)
      .values({
        companyId: session.companyId,
        fileName,
        originalName: file.name,
        title: title || file.name,
        description: description || null,
        url,
        thumbnailUrl: thumbnailUrl || null,
        mimeType: file.type,
        fileType: getFileType(file.type),
        sizeBytes: file.size,
        category: category || null,
        tags: tags || null,
        jobId: jobId ? parseInt(jobId) : null,
        customerId: customerId ? parseInt(customerId) : null,
        employeeId: employeeId ? parseInt(employeeId) : null,
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        uploadedBy: session.id,
      })
      .returning()

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}


