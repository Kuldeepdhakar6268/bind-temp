import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomBytes } from "crypto"

// File storage configuration
export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]

// Ensure upload directories exist
export async function ensureUploadDirs() {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, "jobs"),
    path.join(UPLOAD_DIR, "customers"),
    path.join(UPLOAD_DIR, "employees"),
    path.join(UPLOAD_DIR, "invoices"),
    path.join(UPLOAD_DIR, "thumbnails"),
  ]

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }
}

// Generate unique filename
export function generateFileName(originalName: string): string {
  const ext = path.extname(originalName)
  const timestamp = Date.now()
  const random = randomBytes(8).toString("hex")
  return `${timestamp}-${random}${ext}`
}

// Get file type category
export function getFileType(mimeType: string): string {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return "image"
  }
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return "document"
  }
  if (mimeType.startsWith("video/")) {
    return "video"
  }
  return "other"
}

// Validate file
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided" }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: "File type not allowed" }
  }

  return { valid: true }
}

// Save file to disk
export async function saveFile(
  file: File,
  category: string = "jobs",
): Promise<{ fileName: string; url: string; thumbnailUrl?: string }> {
  await ensureUploadDirs()

  const fileName = generateFileName(file.name)
  const filePath = path.join(UPLOAD_DIR, category, fileName)
  const url = `/uploads/${category}/${fileName}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  await writeFile(filePath, buffer)

  // TODO: Generate thumbnail for images
  // For now, we'll use the original image as thumbnail
  const thumbnailUrl = getFileType(file.type) === "image" ? url : undefined

  return { fileName, url, thumbnailUrl }
}

// Get file extension from mime type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/plain": ".txt",
    "text/csv": ".csv",
  }
  return mimeToExt[mimeType] || ""
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
}

