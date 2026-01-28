"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUpload } from "@/components/ui/file-upload"
import { FileGallery } from "@/components/ui/file-gallery"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Attachment {
  id: number
  fileName: string
  originalName: string
  title?: string | null
  description?: string | null
  url: string
  thumbnailUrl?: string | null
  mimeType: string
  fileType: string
  sizeBytes: number
  category?: string | null
  createdAt: string
}

interface JobPhotosProps {
  jobId: number
}

export function JobPhotos({ jobId }: JobPhotosProps) {
  const [photos, setPhotos] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchPhotos()
  }, [jobId])

  const fetchPhotos = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/attachments?jobId=${jobId}&fileType=image`)
      if (!response.ok) {
        throw new Error("Failed to fetch photos")
      }
      const data = await response.json()
      setPhotos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File, category: string) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", category)
    formData.append("jobId", jobId.toString())
    formData.append("title", `${category === "before-photo" ? "Before" : "After"} - ${file.name}`)

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Upload failed")
    }

    await fetchPhotos()
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/attachments/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete photo")
      }

      await fetchPhotos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete photo")
    }
  }

  const beforePhotos = photos.filter((p) => p.category === "before-photo")
  const afterPhotos = photos.filter((p) => p.category === "after-photo")
  const otherPhotos = photos.filter((p) => !p.category || (p.category !== "before-photo" && p.category !== "after-photo"))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Photos</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="before" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="before">
                Before ({beforePhotos.length})
              </TabsTrigger>
              <TabsTrigger value="after">
                After ({afterPhotos.length})
              </TabsTrigger>
              <TabsTrigger value="other">
                Other ({otherPhotos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="before" className="space-y-4">
              <FileUpload
                onUpload={(file) => handleUpload(file, "before-photo")}
                accept="image/*"
                maxSize={10}
              />
              <FileGallery files={beforePhotos} onDelete={handleDelete} />
            </TabsContent>

            <TabsContent value="after" className="space-y-4">
              <FileUpload
                onUpload={(file) => handleUpload(file, "after-photo")}
                accept="image/*"
                maxSize={10}
              />
              <FileGallery files={afterPhotos} onDelete={handleDelete} />
            </TabsContent>

            <TabsContent value="other" className="space-y-4">
              <FileUpload
                onUpload={(file) => handleUpload(file, "other")}
                accept="image/*"
                maxSize={10}
              />
              <FileGallery files={otherPhotos} onDelete={handleDelete} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

