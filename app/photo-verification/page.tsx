"use client"

import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Camera, Check, X, Search, Filter, Calendar, MapPin, User, Clock } from "lucide-react"
import { useState } from "react"

const photoVerifications = [
  {
    id: 1,
    jobId: "JOB-1234",
    client: "Elite Towers",
    location: "123 Main St",
    staff: "Sarah Chen",
    date: "2024-01-15",
    time: "10:30 AM",
    status: "verified",
    beforePhotos: 3,
    afterPhotos: 3,
    rating: 5,
  },
  {
    id: 2,
    jobId: "JOB-1235",
    client: "City Hall",
    location: "456 Oak Ave",
    staff: "Mike Johnson",
    date: "2024-01-15",
    time: "2:00 PM",
    status: "pending",
    beforePhotos: 2,
    afterPhotos: 0,
    rating: null,
  },
  {
    id: 3,
    jobId: "JOB-1236",
    client: "Grand Hotel",
    location: "321 Beach Rd",
    staff: "Lisa Wong",
    date: "2024-01-15",
    time: "9:00 AM",
    status: "verified",
    beforePhotos: 4,
    afterPhotos: 4,
    rating: 5,
  },
  {
    id: 4,
    jobId: "JOB-1237",
    client: "Tech Campus",
    location: "789 Park Blvd",
    staff: "Tom Brown",
    date: "2024-01-14",
    time: "3:30 PM",
    status: "issue",
    beforePhotos: 2,
    afterPhotos: 1,
    rating: 3,
  },
]

export default function PhotoVerificationPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedJob, setSelectedJob] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Photo Verification</h1>
            <p className="text-muted-foreground mt-1">Review before/after photos and quality checks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Date Range
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold">156</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <X className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issues</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Camera className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Photos</p>
                <p className="text-2xl font-bold">1,024</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job ID, client, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-4">
            {photoVerifications.map((job) => (
              <div key={job.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{job.client}</h3>
                      <Badge
                        variant="secondary"
                        className={
                          job.status === "verified"
                            ? "bg-green-500/10 text-green-700"
                            : job.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-700"
                              : "bg-red-500/10 text-red-700"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {job.staff}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {job.date} at {job.time}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{job.jobId}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Before Photos ({job.beforePhotos})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[...Array(job.beforePhotos)].map((_, i) => (
                        <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden">
                          <img
                            src={`/office-before-cleaning-.jpg?height=100&width=100&query=office+before+cleaning+${i}`}
                            alt={`Before ${i + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setSelectedJob(job.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">After Photos ({job.afterPhotos})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {job.afterPhotos > 0 ? (
                        [...Array(job.afterPhotos)].map((_, i) => (
                          <div key={i} className="aspect-square bg-muted rounded-lg overflow-hidden">
                            <img
                              src={`/clean-office-after-cleaning-.jpg?height=100&width=100&query=clean+office+after+cleaning+${i}`}
                              alt={`After ${i + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setSelectedJob(job.id)}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs col-span-3">
                          Awaiting photos
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {job.status === "pending" && (
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="default">
                      <Check className="h-4 w-4 mr-2" />
                      Verify
                    </Button>
                    <Button size="sm" variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Flag Issue
                    </Button>
                  </div>
                )}

                {job.rating && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Customer Rating:</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < job.rating! ? "text-yellow-500" : "text-muted"}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
