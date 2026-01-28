"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { File, FileText, Image as ImageIcon, Download, Trash2, X, Eye } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

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

interface FileGalleryProps {
  files: Attachment[]
  onDelete?: (id: number) => void
  className?: string
}

export function FileGallery({ files, onDelete, className }: FileGalleryProps) {
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<Attachment | null>(null)

  const getFileIcon = (fileType: string, mimeType: string) => {
    if (fileType === "image") {
      return <ImageIcon className="h-8 w-8 text-blue-500" />
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-8 w-8 text-red-500" />
    }
    return <File className="h-8 w-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const handleDelete = async () => {
    if (fileToDelete && onDelete) {
      await onDelete(fileToDelete.id)
      setDeleteDialogOpen(false)
      setFileToDelete(null)
      if (selectedFile?.id === fileToDelete.id) {
        setSelectedFile(null)
      }
    }
  }

  const openDeleteDialog = (file: Attachment) => {
    setFileToDelete(file)
    setDeleteDialogOpen(true)
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    )
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4", className)}>
        {files.map((file) => (
          <Card key={file.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div
                className="aspect-square bg-muted flex items-center justify-center cursor-pointer relative group"
                onClick={() => setSelectedFile(file)}
              >
                {file.fileType === "image" && file.url ? (
                  <img src={file.url} alt={file.title || file.originalName} className="w-full h-full object-cover" />
                ) : (
                  getFileIcon(file.fileType, file.mimeType)
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button variant="secondary" size="icon" onClick={() => setSelectedFile(file)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(file.url, "_blank")
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {onDelete && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDeleteDialog(file)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="p-3">
                <div className="text-sm font-medium truncate">{file.title || file.originalName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatFileSize(file.sizeBytes)}
                  {file.category && (
                    <>
                      {" • "}
                      <Badge variant="outline" className="text-xs">
                        {file.category}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(file.createdAt), "MMM d, yyyy")}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Preview Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedFile?.title || selectedFile?.originalName}</DialogTitle>
            {selectedFile?.description && <DialogDescription>{selectedFile.description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4">
            {selectedFile?.fileType === "image" && selectedFile.url && (
              <div className="max-h-[60vh] overflow-auto">
                <img
                  src={selectedFile.url}
                  alt={selectedFile.title || selectedFile.originalName}
                  className="w-full h-auto"
                />
              </div>
            )}

            {selectedFile?.fileType !== "image" && (
              <div className="flex items-center justify-center py-12 bg-muted rounded-lg">
                {getFileIcon(selectedFile?.fileType || "", selectedFile?.mimeType || "")}
                <div className="ml-4">
                  <div className="font-medium">{selectedFile?.originalName}</div>
                  <div className="text-sm text-muted-foreground">{formatFileSize(selectedFile?.sizeBytes || 0)}</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFile(null)}>
              Close
            </Button>
            <Button onClick={() => selectedFile && window.open(selectedFile.url, "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fileToDelete?.title || fileToDelete?.originalName}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

