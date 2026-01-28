"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  CheckCircle,
  Clock,
  MapPin,
  User,
  Calendar,
  Image,
  Search,
  Filter,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Building,
  Phone,
  Mail,
} from "lucide-react"
import Link from "next/link"

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

interface Customer {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  address: string | null
}

interface VerificationPhoto {
  id: number
  url: string
  thumbnailUrl: string | null
  caption: string | null
  capturedAt: string
  latitude: string | null
  longitude: string | null
  capturedAddress: string | null
  verificationStatus: string
  verifiedBy: number | null
  verifiedAt: string | null
  taskId: number | null
  taskName?: string
}

interface CompletedJob {
  id: number
  title: string
  description: string | null
  location: string | null
  city: string | null
  postcode: string | null
  scheduledFor: string | null
  scheduledEnd: string | null
  completedAt: string | null
  status: string
  estimatedPrice: string | null
  employee: Employee | null
  customer: Customer | null
  photos: VerificationPhoto[]
  checkInTime: string | null
  checkOutTime: string | null
  jobDuration: number | null // in minutes
  tasksCompleted: number
  totalTasks: number
}

export default function CompletedJobsPage() {
  const [jobs, setJobs] = useState<CompletedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<VerificationPhoto | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    loadEmployees()
    loadCompletedJobs()
  }, [selectedEmployee])

  const loadEmployees = async () => {
    try {
      const res = await fetch("/api/employees")
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.employees || data)
      }
    } catch (error) {
      console.error("Error loading employees:", error)
    }
  }

  const loadCompletedJobs = async () => {
    setLoading(true)
    try {
      let url = "/api/jobs/completed"
      if (selectedEmployee !== "all") {
        url += `?employeeId=${selectedEmployee}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error("Error loading completed jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const verifyPhoto = async (photoId: number, status: "verified" | "rejected") => {
    setVerifying(true)
    try {
      const res = await fetch(`/api/photos/${photoId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        toast.success(`Photo ${status === "verified" ? "verified" : "rejected"}`)
        // Update local state
        setJobs(prev => prev.map(job => ({
          ...job,
          photos: job.photos.map(p => 
            p.id === photoId 
              ? { ...p, verificationStatus: status, verifiedAt: new Date().toISOString() }
              : p
          )
        })))
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(prev => prev ? { ...prev, verificationStatus: status } : null)
        }
      } else {
        toast.error("Failed to verify photo")
      }
    } catch (error) {
      console.error("Error verifying photo:", error)
      toast.error("Failed to verify photo")
    } finally {
      setVerifying(false)
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }

  const filteredJobs = jobs.filter(job => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = job.title?.toLowerCase().includes(query)
      const matchesCustomer = `${job.customer?.firstName} ${job.customer?.lastName}`.toLowerCase().includes(query)
      const matchesEmployee = `${job.employee?.firstName} ${job.employee?.lastName}`.toLowerCase().includes(query)
      const matchesLocation = job.location?.toLowerCase().includes(query)
      return matchesTitle || matchesCustomer || matchesEmployee || matchesLocation
    }
    return true
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Completed Jobs</h1>
          <p className="text-muted-foreground">Review completed jobs and verify employee work photos</p>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-48">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Camera className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Photos</p>
                <p className="text-xl font-bold">{jobs.reduce((sum, j) => sum + j.photos.length, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-xl font-bold">
                  {jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "pending").length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ThumbsUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-xl font-bold">
                  {jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "verified").length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Completed Jobs</h3>
            <p className="text-muted-foreground">
              {selectedEmployee !== "all" 
                ? "No completed jobs found for this employee"
                : "No completed jobs to display"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Job Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{job.title}</h3>
                        <p className="text-sm text-muted-foreground">{job.description}</p>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {/* Employee */}
                      {job.employee && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{job.employee.firstName} {job.employee.lastName}</span>
                        </div>
                      )}

                      {/* Customer */}
                      {job.customer && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>{job.customer.firstName} {job.customer.lastName}</span>
                        </div>
                      )}

                      {/* Date */}
                      {job.completedAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(job.completedAt), "MMM d, yyyy")}</span>
                        </div>
                      )}

                      {/* Duration */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Duration: {formatDuration(job.jobDuration)}</span>
                      </div>
                    </div>

                    {/* Location */}
                    {job.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location}{job.city ? `, ${job.city}` : ""}{job.postcode ? ` ${job.postcode}` : ""}</span>
                      </div>
                    )}

                    {/* Tasks */}
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Tasks: {job.tasksCompleted}/{job.totalTasks} completed</span>
                    </div>
                  </div>

                  {/* Photos Preview */}
                  <div className="md:w-64">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        <Camera className="h-4 w-4 inline mr-1" />
                        {job.photos.length} Photos
                      </span>
                      {job.photos.some(p => p.verificationStatus === "pending") && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Needs Review
                        </Badge>
                      )}
                    </div>
                    {job.photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1">
                        {job.photos.slice(0, 6).map((photo, idx) => (
                          <div 
                            key={photo.id} 
                            className="relative aspect-square cursor-pointer group"
                            onClick={() => {
                              setSelectedJob(job)
                              setSelectedPhoto(photo)
                              setPhotoViewerOpen(true)
                            }}
                          >
                            <img
                              src={photo.thumbnailUrl || photo.url}
                              alt={photo.caption || "Job photo"}
                              className="w-full h-full object-cover rounded"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                              <Eye className="h-4 w-4 text-white" />
                            </div>
                            {photo.verificationStatus === "verified" && (
                              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                                <CheckCircle className="h-3 w-3 text-white" />
                              </div>
                            )}
                            {idx === 5 && job.photos.length > 6 && (
                              <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                                <span className="text-white font-medium">+{job.photos.length - 6}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-muted rounded-lg">
                        <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground opacity-50" />
                        <p className="text-xs text-muted-foreground">No photos</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        setSelectedJob(job)
                        setSelectedPhoto(job.photos[0] || null)
                        setPhotoViewerOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Photo Viewer Dialog */}
      <Dialog open={photoViewerOpen} onOpenChange={setPhotoViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Details - {selectedJob?.title}</DialogTitle>
            <DialogDescription>
              Review verification photos and job completion details
            </DialogDescription>
          </DialogHeader>

          {selectedJob && (
            <div className="space-y-6">
              {/* Job Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                {selectedJob.employee && (
                  <div>
                    <p className="text-xs text-muted-foreground">Employee</p>
                    <p className="font-medium">{selectedJob.employee.firstName} {selectedJob.employee.lastName}</p>
                  </div>
                )}
                {selectedJob.customer && (
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-medium">{selectedJob.customer.firstName} {selectedJob.customer.lastName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="font-medium">
                    {selectedJob.checkInTime 
                      ? format(new Date(selectedJob.checkInTime), "HH:mm")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Check-out</p>
                  <p className="font-medium">
                    {selectedJob.checkOutTime 
                      ? format(new Date(selectedJob.checkOutTime), "HH:mm")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(selectedJob.jobDuration)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="font-medium">{selectedJob.tasksCompleted}/{selectedJob.totalTasks}</p>
                </div>
                {selectedJob.estimatedPrice && (
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium">£{parseFloat(selectedJob.estimatedPrice).toFixed(2)}</p>
                  </div>
                )}
              </div>

              {/* Photos Gallery */}
              {selectedJob.photos.length > 0 ? (
                <div>
                  <h4 className="font-medium mb-3">Verification Photos ({selectedJob.photos.length})</h4>
                  
                  {/* Selected Photo */}
                  {selectedPhoto && (
                    <div className="mb-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <img
                          src={selectedPhoto.url}
                          alt={selectedPhoto.caption || "Verification photo"}
                          className="w-full max-h-[400px] object-contain mx-auto"
                        />
                      </div>
                      
                      {/* Photo Details */}
                      <div className="mt-3 p-4 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                selectedPhoto.verificationStatus === "verified" ? "default" :
                                selectedPhoto.verificationStatus === "rejected" ? "destructive" :
                                "outline"
                              }
                              className={selectedPhoto.verificationStatus === "verified" ? "bg-green-600" : ""}
                            >
                              {selectedPhoto.verificationStatus === "verified" && <CheckCircle className="h-3 w-3 mr-1" />}
                              {selectedPhoto.verificationStatus === "rejected" && <X className="h-3 w-3 mr-1" />}
                              {selectedPhoto.verificationStatus.charAt(0).toUpperCase() + selectedPhoto.verificationStatus.slice(1)}
                            </Badge>
                            {selectedPhoto.taskName && (
                              <span className="text-sm text-muted-foreground">
                                Task: {selectedPhoto.taskName}
                              </span>
                            )}
                          </div>
                          
                          {/* Verify Buttons */}
                          {selectedPhoto.verificationStatus === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => verifyPhoto(selectedPhoto.id, "verified")}
                                disabled={verifying}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <ThumbsUp className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => verifyPhoto(selectedPhoto.id, "rejected")}
                                disabled={verifying}
                              >
                                <ThumbsDown className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(selectedPhoto.capturedAt), "MMM d, yyyy HH:mm")}</span>
                          </div>
                          {selectedPhoto.capturedAddress && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{selectedPhoto.capturedAddress}</span>
                            </div>
                          )}
                        </div>
                        
                        {selectedPhoto.caption && (
                          <p className="text-sm italic">"{selectedPhoto.caption}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photo Thumbnails */}
                  <div className="grid grid-cols-6 gap-2">
                    {selectedJob.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square cursor-pointer rounded overflow-hidden border-2 transition-all ${
                          selectedPhoto?.id === photo.id 
                            ? "border-primary ring-2 ring-primary/20" 
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        onClick={() => setSelectedPhoto(photo)}
                      >
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt={photo.caption || "Photo"}
                          className="w-full h-full object-cover"
                        />
                        {photo.verificationStatus === "verified" && (
                          <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {photo.verificationStatus === "rejected" && (
                          <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5">
                            <X className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-muted rounded-lg">
                  <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No verification photos for this job</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
