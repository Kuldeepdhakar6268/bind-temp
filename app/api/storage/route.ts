import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and, desc, ilike } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/storage - List attachments/files
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
    const search = searchParams.get("search")
    const jobId = searchParams.get("jobId")
    const customerId = searchParams.get("customerId")
    const fileType = searchParams.get("fileType")
    const category = searchParams.get("category")

    const conditions = [eq(schema.attachments.companyId, session.companyId)]
    
    if (jobId) conditions.push(eq(schema.attachments.jobId, parseInt(jobId)))
    if (customerId) conditions.push(eq(schema.attachments.customerId, parseInt(customerId)))
    if (fileType) conditions.push(eq(schema.attachments.fileType, fileType))
    if (category) conditions.push(eq(schema.attachments.category, category))
    if (search) {
      conditions.push(ilike(schema.attachments.fileName, `%${search}%`))
    }

    const files = await db.query.attachments.findMany({
      where: and(...conditions),
      orderBy: [desc(schema.attachments.createdAt)],
    })

    // Calculate storage usage using sizeBytes
    const totalSize = files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0)

    return NextResponse.json({
      files,
      summary: {
        totalFiles: files.length,
        totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      },
    })
  } catch (error) {
    console.error("Error fetching storage:", error)
    return NextResponse.json({ error: "Failed to fetch storage" }, { status: 500 })
  }
}

// POST /api/storage - Upload file metadata (actual upload via /api/upload)
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      fileName, 
      originalName,
      url, 
      fileType, 
      mimeType,
      sizeBytes, 
      jobId, 
      customerId,
      invoiceId,
      employeeId,
      title,
      description,
      category
    } = body

    if (!fileName || !url || !originalName || !mimeType || !fileType) {
      return NextResponse.json({ 
        error: "fileName, originalName, url, mimeType, and fileType are required" 
      }, { status: 400 })
    }

    const [attachment] = await db
      .insert(schema.attachments)
      .values({
        companyId: session.companyId,
        fileName,
        originalName,
        url,
        fileType,
        mimeType,
        sizeBytes: sizeBytes || 0,
        jobId: jobId ? parseInt(jobId) : null,
        customerId: customerId ? parseInt(customerId) : null,
        invoiceId: invoiceId ? parseInt(invoiceId) : null,
        employeeId: employeeId ? parseInt(employeeId) : null,
        title: title || null,
        description: description || null,
        category: category || null,
        uploadedBy: session.id,
        createdAt: new Date(),
      })
      .returning()

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error("Error creating attachment:", error)
    return NextResponse.json({ error: "Failed to create attachment" }, { status: 500 })
  }
}

