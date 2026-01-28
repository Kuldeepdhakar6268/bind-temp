"use client"

import { useState, useEffect } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns"
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
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
  Star,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  MessageSquare,
  Send,
  RefreshCw,
  Download,
  ExternalLink,
  CheckCheck,
  XCircle,
  Timer,
  Navigation,
  Target,
  Award,
} from "lucide-react"
import Link from "next/link"

interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  avatar?: string
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
  locationAccuracy: string | null
  capturedAddress: string | null
  verificationStatus: string
  verifiedBy: number | null
  verifiedAt: string | null
  rejectionReason?: string | null
  taskId: number | null
  taskName?: string
  distanceFromJobSite?: number | null
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
  checkInLocation?: { lat: number; lng: number } | null
  checkOutLocation?: { lat: number; lng: number } | null
  jobDuration: number | null
  tasksCompleted: number
  totalTasks: number
  verificationScore?: number
}

interface EmployeeStats {
  employeeId: number
  employee: Employee
  totalJobs: number
  totalPhotos: number
  verifiedPhotos: number
  rejectedPhotos: number
  pendingPhotos: number
  avgJobDuration: number
  avgPhotosPerJob: number
  verificationRate: number
  onTimeRate: number
}

export default function VerificationCenterPage() {
  const [jobs, setJobs] = useState<CompletedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedJob, setSelectedJob] = useState<CompletedJob | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<VerificationPhoto | null>(null)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([])
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([])
  const [dateFilter, setDateFilter] = useState<string>("all")

  useEffect(() => {
    loadEmployees()
    loadCompletedJobs()
  }, [selectedEmployee, dateFilter])

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
      let url = "/api/verification-center"
      const params = new URLSearchParams()
      if (selectedEmployee !== "all") params.set("employeeId", selectedEmployee)
      if (dateFilter !== "all") params.set("dateFilter", dateFilter)
      if (params.toString()) url += `?${params.toString()}`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
        setEmployeeStats(data.employeeStats || [])
      }
    } catch (error) {
      console.error("Error loading completed jobs:", error)
    } finally {
      setLoading(false)
    }
  }

  const verifyPhoto = async (photoId: number, status: "verified" | "rejected", reason?: string) => {
    setVerifying(true)
    try {
      const res = await fetch(`/api/photos/${photoId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejectionReason: reason }),
      })

      if (res.ok) {
        toast.success(`Photo ${status === "verified" ? "verified" : "rejected"}`)
        updatePhotoStatus(photoId, status, reason)
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

  const bulkVerify = async (status: "verified" | "rejected", reason?: string) => {
    if (selectedPhotos.length === 0) return
    
    setVerifying(true)
    try {
      const res = await fetch("/api/photos/bulk-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: selectedPhotos, status, rejectionReason: reason }),
      })

      if (res.ok) {
        toast.success(`${selectedPhotos.length} photos ${status}`)
        selectedPhotos.forEach(id => updatePhotoStatus(id, status, reason))
        setSelectedPhotos([])
        setBulkSelectMode(false)
      } else {
        toast.error("Failed to bulk verify photos")
      }
    } catch (error) {
      console.error("Error bulk verifying:", error)
      toast.error("Failed to bulk verify photos")
    } finally {
      setVerifying(false)
      setRejectionDialogOpen(false)
    }
  }

  const updatePhotoStatus = (photoId: number, status: string, reason?: string) => {
    setJobs(prev => prev.map(job => ({
      ...job,
      photos: job.photos.map(p => 
        p.id === photoId 
          ? { ...p, verificationStatus: status, verifiedAt: new Date().toISOString(), rejectionReason: reason }
          : p
      )
    })))
    if (selectedPhoto?.id === photoId) {
      setSelectedPhoto(prev => prev ? { ...prev, verificationStatus: status, rejectionReason: reason } : null)
    }
  }

  const sendEmployeeFeedback = async () => {
    if (!selectedJob?.employee || !feedback.trim()) return
    
    try {
      const res = await fetch("/api/employee-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          employeeId: selectedJob.employee.id,
          jobId: selectedJob.id,
          message: feedback,
          type: "verification_feedback"
        }),
      })

      if (res.ok) {
        toast.success("Feedback sent to employee")
        setFeedback("")
        setFeedbackDialogOpen(false)
      }
    } catch (error) {
      toast.error("Failed to send feedback")
    }
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }

  const getVerificationScore = (job: CompletedJob) => {
    if (job.photos.length === 0) return 0
    const verified = job.photos.filter(p => p.verificationStatus === "verified").length
    return Math.round((verified / job.photos.length) * 100)
  }

  const getGPSAccuracyStatus = (photo: VerificationPhoto) => {
    if (!photo.latitude || !photo.longitude) return { status: "none", label: "No GPS", color: "text-gray-500" }
    const accuracy = parseFloat(photo.locationAccuracy || "0")
    if (accuracy <= 10) return { status: "excellent", label: "Excellent", color: "text-green-600" }
    if (accuracy <= 30) return { status: "good", label: "Good", color: "text-blue-600" }
    if (accuracy <= 100) return { status: "fair", label: "Fair", color: "text-amber-600" }
    return { status: "poor", label: "Poor", color: "text-red-600" }
  }

  // Filter jobs based on tab and search
  const filteredJobs = jobs.filter(job => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = job.title?.toLowerCase().includes(query)
      const matchesCustomer = `${job.customer?.firstName} ${job.customer?.lastName}`.toLowerCase().includes(query)
      const matchesEmployee = `${job.employee?.firstName} ${job.employee?.lastName}`.toLowerCase().includes(query)
      const matchesLocation = job.location?.toLowerCase().includes(query)
      if (!matchesTitle && !matchesCustomer && !matchesEmployee && !matchesLocation) return false
    }
    return true
  })

  // Get pending photos count
  const pendingPhotosJobs = filteredJobs.filter(j => j.photos.some(p => p.verificationStatus === "pending"))
  const verifiedPhotosJobs = filteredJobs.filter(j => j.photos.every(p => p.verificationStatus === "verified") && j.photos.length > 0)
  const issuesJobs = filteredJobs.filter(j => j.photos.some(p => p.verificationStatus === "rejected"))

  const displayJobs = activeTab === "pending" ? pendingPhotosJobs 
    : activeTab === "verified" ? verifiedPhotosJobs 
    : activeTab === "issues" ? issuesJobs 
    : filteredJobs

  // Calculate stats
  const stats = {
    totalJobs: jobs.length,
    totalPhotos: jobs.reduce((sum, j) => sum + j.photos.length, 0),
    pendingPhotos: jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "pending").length, 0),
    verifiedPhotos: jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "verified").length, 0),
    rejectedPhotos: jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "rejected").length, 0),
    avgDuration: jobs.length > 0 ? Math.round(jobs.reduce((sum, j) => sum + (j.jobDuration || 0), 0) / jobs.length) : 0,
    verificationRate: jobs.reduce((sum, j) => sum + j.photos.length, 0) > 0 
      ? Math.round((jobs.reduce((sum, j) => sum + j.photos.filter(p => p.verificationStatus === "verified").length, 0) / 
        jobs.reduce((sum, j) => sum + j.photos.length, 0)) * 100) : 0,
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />
      <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="pl-12 md:pl-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Verification Center
          </h1>
          <p className="text-muted-foreground">Review, verify, and manage job completion evidence</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto pl-12 md:pl-2">
          <Button variant="outline" onClick={loadCompletedJobs} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Jobs</p>
                <p className="text-2xl font-bold text-blue-700">{stats.totalJobs}</p>
              </div>
              <div className="p-2 bg-blue-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 font-medium">Total Photos</p>
                <p className="text-2xl font-bold text-purple-700">{stats.totalPhotos}</p>
              </div>
              <div className="p-2 bg-purple-200 rounded-lg">
                <Camera className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Pending Review</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pendingPhotos}</p>
              </div>
              <div className="p-2 bg-amber-200 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            {stats.pendingPhotos > 0 && (
              <Badge variant="outline" className="mt-2 text-amber-600 border-amber-300 text-xs">
                Action Required
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 font-medium">Verified</p>
                <p className="text-2xl font-bold text-green-700">{stats.verifiedPhotos}</p>
              </div>
              <div className="p-2 bg-green-200 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-600 font-medium">Rejected</p>
                <p className="text-2xl font-bold text-red-700">{stats.rejectedPhotos}</p>
              </div>
              <div className="p-2 bg-red-200 rounded-lg">
                <ShieldX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Verification Rate</p>
                <p className="text-2xl font-bold text-indigo-700">{stats.verificationRate}%</p>
              </div>
              <div className="p-2 bg-indigo-200 rounded-lg">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
            </div>
            <Progress value={stats.verificationRate} className="mt-2 h-1" />
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col w-full gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs, employees..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-full">
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

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {bulkSelectMode ? (
            <>
              <Badge variant="outline" className="py-1.5">
                {selectedPhotos.length} selected
              </Badge>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => bulkVerify("verified")}
                disabled={selectedPhotos.length === 0 || verifying}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Verify All
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => setRejectionDialogOpen(true)}
                disabled={selectedPhotos.length === 0 || verifying}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject All
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setBulkSelectMode(false)
                  setSelectedPhotos([])
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setBulkSelectMode(true)}
              className="w-full"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Bulk Select
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap w-full gap-2 h-auto bg-transparent p-0 md:inline-flex md:w-max md:min-w-full md:bg-muted md:p-[3px] md:gap-0 md:h-9">
          <TabsTrigger
            value="all"
            className="flex flex-none w-[calc(50%-0.25rem)] gap-2 whitespace-normal h-auto py-2 text-xs md:flex-1 md:w-auto md:whitespace-nowrap md:h-[calc(100%-1px)] md:py-1 md:text-sm"
          >
            <BarChart3 className="h-4 w-4" />
            All Jobs
            <Badge variant="secondary" className="ml-1">{filteredJobs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className="flex flex-none w-[calc(50%-0.25rem)] gap-2 whitespace-normal h-auto py-2 text-xs md:flex-1 md:w-auto md:whitespace-nowrap md:h-[calc(100%-1px)] md:py-1 md:text-sm"
          >
            <Clock className="h-4 w-4" />
            Pending Review
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
              {pendingPhotosJobs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="verified"
            className="flex flex-none w-[calc(50%-0.25rem)] gap-2 whitespace-normal h-auto py-2 text-xs md:flex-1 md:w-auto md:whitespace-nowrap md:h-[calc(100%-1px)] md:py-1 md:text-sm"
          >
            <ShieldCheck className="h-4 w-4" />
            Verified
            <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">
              {verifiedPhotosJobs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="issues"
            className="flex flex-none w-[calc(50%-0.25rem)] gap-2 whitespace-normal h-auto py-2 text-xs md:flex-1 md:w-auto md:whitespace-nowrap md:h-[calc(100%-1px)] md:py-1 md:text-sm"
          >
            <AlertTriangle className="h-4 w-4" />
            Issues
            <Badge variant="secondary" className="ml-1 bg-red-100 text-red-700">
              {issuesJobs.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayJobs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === "pending" ? "All Caught Up!" : 
                   activeTab === "verified" ? "No Verified Jobs" : 
                   activeTab === "issues" ? "No Issues Found" : 
                   "No Completed Jobs"}
                </h3>
                <p className="text-muted-foreground">
                  {activeTab === "pending" ? "No photos pending review" : 
                   activeTab === "verified" ? "No jobs with all photos verified" : 
                   activeTab === "issues" ? "No jobs with rejected photos" : 
                   "No completed jobs to display"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayJobs.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job}
                  bulkSelectMode={bulkSelectMode}
                  selectedPhotos={selectedPhotos}
                  onSelectPhoto={(photoId) => {
                    setSelectedPhotos(prev => 
                      prev.includes(photoId) 
                        ? prev.filter(id => id !== photoId)
                        : [...prev, photoId]
                    )
                  }}
                  onViewDetails={() => {
                    setSelectedJob(job)
                    setSelectedPhoto(job.photos[0] || null)
                    setPhotoViewerOpen(true)
                  }}
                  onVerifyPhoto={(photoId, status) => verifyPhoto(photoId, status)}
                  getVerificationScore={getVerificationScore}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Photo Viewer Dialog */}
      <Dialog open={photoViewerOpen} onOpenChange={setPhotoViewerOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">{selectedJob?.title}</DialogTitle>
                <DialogDescription>
                  Job #{selectedJob?.id} • {selectedJob?.completedAt && format(new Date(selectedJob.completedAt), "PPP")}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFeedbackDialogOpen(true)}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Send Feedback
                </Button>
              </div>
            </div>
          </DialogHeader>

          {selectedJob && (
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Job Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Employee</p>
                        <p className="font-medium">
                          {selectedJob.employee ? `${selectedJob.employee.firstName} ${selectedJob.employee.lastName}` : "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-medium">{formatDuration(selectedJob.jobDuration)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tasks</p>
                        <p className="font-medium">{selectedJob.tasksCompleted}/{selectedJob.totalTasks}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Photos</p>
                        <p className="font-medium">{selectedJob.photos.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Verification</p>
                        <p className="font-medium">{getVerificationScore(selectedJob)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Check-in/out Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Job Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Check-in:</span>{" "}
                        <span className="font-medium">
                          {selectedJob.checkInTime ? format(new Date(selectedJob.checkInTime), "HH:mm") : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-green-500 to-blue-500" />
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Check-out:</span>{" "}
                        <span className="font-medium">
                          {selectedJob.checkOutTime ? format(new Date(selectedJob.checkOutTime), "HH:mm") : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Photo Gallery */}
              {selectedJob.photos.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Verification Photos</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {selectedJob.photos.filter(p => p.verificationStatus === "verified").length} verified
                      </Badge>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {selectedJob.photos.filter(p => p.verificationStatus === "pending").length} pending
                      </Badge>
                      {selectedJob.photos.some(p => p.verificationStatus === "rejected") && (
                        <Badge variant="outline" className="bg-red-50 text-red-700">
                          {selectedJob.photos.filter(p => p.verificationStatus === "rejected").length} rejected
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Selected Photo View */}
                  {selectedPhoto && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* Photo */}
                          <div className="relative bg-black rounded-lg overflow-hidden">
                            <img
                              src={selectedPhoto.url}
                              alt={selectedPhoto.caption || "Verification photo"}
                              className="w-full h-[350px] object-contain"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge 
                                className={
                                  selectedPhoto.verificationStatus === "verified" ? "bg-green-600" :
                                  selectedPhoto.verificationStatus === "rejected" ? "bg-red-600" :
                                  "bg-amber-600"
                                }
                              >
                                {selectedPhoto.verificationStatus}
                              </Badge>
                            </div>
                          </div>

                          {/* Photo Details */}
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-medium mb-2">Photo Details</h5>
                              <div className="space-y-2 text-sm">
                                {selectedPhoto.taskName && (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                    <span>Task: {selectedPhoto.taskName}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span>{format(new Date(selectedPhoto.capturedAt), "PPP p")}</span>
                                </div>
                                {selectedPhoto.capturedAddress && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="truncate">{selectedPhoto.capturedAddress}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Navigation className="h-4 w-4 text-muted-foreground" />
                                  <span>GPS: {selectedPhoto.latitude && selectedPhoto.longitude 
                                    ? `${parseFloat(selectedPhoto.latitude).toFixed(6)}, ${parseFloat(selectedPhoto.longitude).toFixed(6)}`
                                    : "Not available"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Target className="h-4 w-4 text-muted-foreground" />
                                  <span className={getGPSAccuracyStatus(selectedPhoto).color}>
                                    Accuracy: {getGPSAccuracyStatus(selectedPhoto).label}
                                    {selectedPhoto.locationAccuracy && ` (±${parseFloat(selectedPhoto.locationAccuracy).toFixed(0)}m)`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {selectedPhoto.caption && (
                              <div>
                                <h5 className="font-medium mb-1">Caption</h5>
                                <p className="text-sm text-muted-foreground italic">"{selectedPhoto.caption}"</p>
                              </div>
                            )}

                            {selectedPhoto.verificationStatus === "rejected" && selectedPhoto.rejectionReason && (
                              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <h5 className="font-medium text-red-800 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  Rejection Reason
                                </h5>
                                <p className="text-sm text-red-700">{selectedPhoto.rejectionReason}</p>
                              </div>
                            )}

                            {/* Action Buttons */}
                            {selectedPhoto.verificationStatus === "pending" && (
                              <div className="flex gap-2 pt-2">
                                <Button
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => verifyPhoto(selectedPhoto.id, "verified")}
                                  disabled={verifying}
                                >
                                  <ThumbsUp className="h-4 w-4 mr-2" />
                                  Verify Photo
                                </Button>
                                <Button
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() => {
                                    setRejectionDialogOpen(true)
                                  }}
                                  disabled={verifying}
                                >
                                  <ThumbsDown className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            )}

                            {selectedPhoto.verificationStatus !== "pending" && (
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => verifyPhoto(selectedPhoto.id, "verified")}
                                disabled={verifying}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Re-verify Photo
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Photo Thumbnails */}
                  <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
                    {selectedJob.photos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedPhoto?.id === photo.id 
                            ? "border-primary ring-2 ring-primary/20 scale-105" 
                            : "border-transparent hover:border-muted-foreground/30"
                        }`}
                        onClick={() => setSelectedPhoto(photo)}
                      >
                        <img
                          src={photo.thumbnailUrl || photo.url}
                          alt={photo.caption || "Photo"}
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute top-1 right-1 rounded-full p-0.5 ${
                          photo.verificationStatus === "verified" ? "bg-green-500" :
                          photo.verificationStatus === "rejected" ? "bg-red-500" :
                          "bg-amber-500"
                        }`}>
                          {photo.verificationStatus === "verified" && <CheckCircle className="h-3 w-3 text-white" />}
                          {photo.verificationStatus === "rejected" && <X className="h-3 w-3 text-white" />}
                          {photo.verificationStatus === "pending" && <Clock className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Camera className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">No verification photos for this job</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <AlertDialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Photo{selectedPhotos.length > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejection. This will be visible to the employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (selectedPhotos.length > 0) {
                  bulkVerify("rejected", rejectionReason)
                } else if (selectedPhoto) {
                  verifyPhoto(selectedPhoto.id, "rejected", rejectionReason)
                  setRejectionDialogOpen(false)
                }
                setRejectionReason("")
              }}
              disabled={!rejectionReason.trim()}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Feedback to Employee</DialogTitle>
            <DialogDescription>
              Send a message to {selectedJob?.employee?.firstName} {selectedJob?.employee?.lastName} about this job.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your feedback..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[150px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>Cancel</Button>
            <Button onClick={sendEmployeeFeedback} disabled={!feedback.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}

// Job Card Component
function JobCard({ 
  job, 
  bulkSelectMode, 
  selectedPhotos, 
  onSelectPhoto, 
  onViewDetails,
  onVerifyPhoto,
  getVerificationScore,
  formatDuration
}: {
  job: CompletedJob
  bulkSelectMode: boolean
  selectedPhotos: number[]
  onSelectPhoto: (photoId: number) => void
  onViewDetails: () => void
  onVerifyPhoto: (photoId: number, status: "verified" | "rejected") => void
  getVerificationScore: (job: CompletedJob) => number
  formatDuration: (minutes: number | null) => string
}) {
  const pendingPhotos = job.photos.filter(p => p.verificationStatus === "pending")
  const verifiedPhotos = job.photos.filter(p => p.verificationStatus === "verified")
  const score = getVerificationScore(job)

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary">
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Job Info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{job.title}</h3>
                  {pendingPhotos.length > 0 && (
                    <Badge className="bg-amber-500">
                      {pendingPhotos.length} pending
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{job.description}</p>
              </div>
              
              {/* Verification Score */}
              <div className="text-center min-w-[70px]">
                <div className={`text-2xl font-bold ${
                  score >= 80 ? "text-green-600" : 
                  score >= 50 ? "text-amber-600" : 
                  "text-red-600"
                }`}>
                  {score}%
                </div>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {job.employee && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Employee</p>
                    <p className="font-medium">{job.employee.firstName} {job.employee.lastName}</p>
                  </div>
                </div>
              )}

              {job.customer && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer</p>
                    <p className="font-medium">{job.customer.firstName} {job.customer.lastName}</p>
                  </div>
                </div>
              )}

              {job.completedAt && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="font-medium">{format(new Date(job.completedAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(job.jobDuration)}</p>
                </div>
              </div>
            </div>

            {job.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{job.location}{job.city ? `, ${job.city}` : ""}{job.postcode ? ` ${job.postcode}` : ""}</span>
              </div>
            )}
          </div>

          {/* Photos Section */}
          <div className="lg:w-80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium flex items-center gap-1">
                <Camera className="h-4 w-4" />
                {job.photos.length} Photos
              </span>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {verifiedPhotos.length}
                </Badge>
                {pendingPhotos.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    {pendingPhotos.length}
                  </Badge>
                )}
              </div>
            </div>

            {job.photos.length > 0 ? (
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {job.photos.slice(0, 8).map((photo, idx) => (
                  <div 
                    key={photo.id} 
                    className={`relative aspect-square cursor-pointer group rounded-md overflow-hidden ${
                      bulkSelectMode && selectedPhotos.includes(photo.id) ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => {
                      if (bulkSelectMode && photo.verificationStatus === "pending") {
                        onSelectPhoto(photo.id)
                      } else if (!bulkSelectMode) {
                        onViewDetails()
                      }
                    }}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.caption || "Job photo"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                    <div className={`absolute top-0.5 right-0.5 rounded-full p-0.5 ${
                      photo.verificationStatus === "verified" ? "bg-green-500" :
                      photo.verificationStatus === "rejected" ? "bg-red-500" :
                      "bg-amber-500"
                    }`}>
                      {photo.verificationStatus === "verified" && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                      {photo.verificationStatus === "rejected" && <X className="h-2.5 w-2.5 text-white" />}
                      {photo.verificationStatus === "pending" && <Clock className="h-2.5 w-2.5 text-white" />}
                    </div>
                    {idx === 7 && job.photos.length > 8 && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">+{job.photos.length - 8}</span>
                      </div>
                    )}
                    {bulkSelectMode && photo.verificationStatus === "pending" && (
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded border-2 ${
                        selectedPhotos.includes(photo.id) 
                          ? "bg-primary border-primary" 
                          : "bg-white/80 border-gray-400"
                      } flex items-center justify-center`}>
                        {selectedPhotos.includes(photo.id) && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-muted rounded-lg mb-3">
                <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">No photos</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onViewDetails}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Details
              </Button>
              {pendingPhotos.length > 0 && !bulkSelectMode && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    pendingPhotos.forEach(p => onVerifyPhoto(p.id, "verified"))
                  }}
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Verify All
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
