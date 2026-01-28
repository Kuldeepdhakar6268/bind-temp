"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUpload } from "@/components/ui/file-upload"
import { FileGallery } from "@/components/ui/file-gallery"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function TestUploadsPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchFiles = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/attachments")
      if (!response.ok) {
        throw new Error("Failed to fetch files")
      }
      const data = await response.json()
      setFiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File, category: string = "test") => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("category", category)
    formData.append("title", `Test Upload - ${file.name}`)

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Upload failed")
    }

    await fetchFiles()
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/attachments/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete file")
      }

      await fetchFiles()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete file")
    }
  }

  const imageFiles = files.filter((f) => f.fileType === "image")
  const documentFiles = files.filter((f) => f.fileType === "document")
  const otherFiles = files.filter((f) => f.fileType !== "image" && f.fileType !== "document")

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">File Upload Test Page</h1>
          <p className="text-muted-foreground">Test the file upload and management system</p>
        </div>
        <Button onClick={fetchFiles} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="images" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="images">Images ({imageFiles.length})</TabsTrigger>
              <TabsTrigger value="documents">Documents ({documentFiles.length})</TabsTrigger>
              <TabsTrigger value="other">Other ({otherFiles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="images" className="space-y-4">
              <FileUpload onUpload={(file) => handleUpload(file, "test-image")} accept="image/*" maxSize={10} />
              <FileGallery files={imageFiles} onDelete={handleDelete} />
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <FileUpload
                onUpload={(file) => handleUpload(file, "test-document")}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                maxSize={10}
              />
              <FileGallery files={documentFiles} onDelete={handleDelete} />
            </TabsContent>

            <TabsContent value="other" className="space-y-4">
              <FileUpload onUpload={(file) => handleUpload(file, "test-other")} maxSize={10} />
              <FileGallery files={otherFiles} onDelete={handleDelete} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Files ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <FileGallery files={files} onDelete={handleDelete} />
        </CardContent>
      </Card>
    </div>
  )
}

