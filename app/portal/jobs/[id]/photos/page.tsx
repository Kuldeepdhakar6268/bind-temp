"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Camera, Calendar, MapPin, Loader2, ImageOff } from "lucide-react"
import Link from "next/link"
import { useCustomerSessionTimeout } from "@/hooks/use-session-timeout"

interface Photo {
  id: number
  url: string
  thumbnailUrl: string | null
  type: string | null
  caption: string | null
  roomArea: string | null
  takenAt: string | null
  uploaderName: string | null
}

interface JobPhotosData {
  job: {
    id: number
    title: string
    status: string
    scheduledFor: string | null
    location: string | null
  }
  photos: {
    before: Photo[]
    after: Photo[]
    other: Photo[]
    total: number
  }
}

export default function CustomerJobPhotosPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  
  const [data, setData] = useState<JobPhotosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)

  // Session timeout - auto logout after 30 minutes of inactivity
  useCustomerSessionTimeout()

  useEffect(() => {
    const fetchPhotos = async () => {
      const token = localStorage.getItem("customer_token")
      if (!token) {
        router.push("/portal")
        return
      }

      try {
        const response = await fetch(`/api/customer-portal/jobs/${jobId}/photos`, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!response.ok) {
          throw new Error("Failed to load photos")
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load photos")
      } finally {
        setLoading(false)
      }
    }

    fetchPhotos()
  }, [jobId, router])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <ImageOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{error || "Unable to load photos"}</p>
            <Button onClick={() => router.push("/portal/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { job, photos } = data

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/portal/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {job.scheduledFor && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(job.scheduledFor)}
                  </span>
                )}
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </span>
                )}
              </div>
            </div>
            <Badge variant={job.status === "completed" ? "default" : "secondary"}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {photos.total === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Photos Yet</h3>
              <p className="text-muted-foreground">
                Photos will appear here once the cleaner uploads them during or after the job.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList>
              <TabsTrigger value="all">All Photos ({photos.total})</TabsTrigger>
              {photos.before.length > 0 && (
                <TabsTrigger value="before">Before ({photos.before.length})</TabsTrigger>
              )}
              {photos.after.length > 0 && (
                <TabsTrigger value="after">After ({photos.after.length})</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="all">
              <PhotoGrid photos={[...photos.before, ...photos.after, ...photos.other]} onSelect={setSelectedPhoto} />
            </TabsContent>

            <TabsContent value="before">
              <Card>
                <CardHeader>
                  <CardTitle>Before Photos</CardTitle>
                  <CardDescription>Photos taken before the cleaning started</CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoGrid photos={photos.before} onSelect={setSelectedPhoto} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="after">
              <Card>
                <CardHeader>
                  <CardTitle>After Photos</CardTitle>
                  <CardDescription>Photos taken after the cleaning was completed</CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoGrid photos={photos.after} onSelect={setSelectedPhoto} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Photo Lightbox */}
        {selectedPhoto && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button 
              className="absolute top-4 right-4 text-white text-2xl"
              onClick={() => setSelectedPhoto(null)}
            >
              ✕
            </button>
            <img 
              src={selectedPhoto.url} 
              alt={selectedPhoto.caption || "Job photo"}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {(selectedPhoto.caption || selectedPhoto.roomArea) && (
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-lg">
                  {selectedPhoto.roomArea && (
                    <span className="font-medium">{selectedPhoto.roomArea}</span>
                  )}
                  {selectedPhoto.roomArea && selectedPhoto.caption && " — "}
                  {selectedPhoto.caption}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function PhotoGrid({ photos, onSelect }: { photos: Photo[], onSelect: (photo: Photo) => void }) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No photos in this category
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <div 
          key={photo.id}
          className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
          onClick={() => onSelect(photo)}
        >
          <img 
            src={photo.thumbnailUrl || photo.url} 
            alt={photo.caption || "Job photo"}
            className="w-full h-full object-cover"
          />
          {photo.type && (
            <Badge 
              className="absolute top-2 left-2"
              variant={photo.type === "before" ? "secondary" : "default"}
            >
              {photo.type.charAt(0).toUpperCase() + photo.type.slice(1)}
            </Badge>
          )}
          {photo.roomArea && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {photo.roomArea}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
