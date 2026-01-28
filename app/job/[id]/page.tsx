import { Metadata } from "next"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Clock, Calendar, User, Phone, Mail, Building, CheckCircle } from "lucide-react"
import { format } from "date-fns"

export const metadata: Metadata = {
  title: "Job Details",
  description: "View your scheduled cleaning job details",
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PublicJobPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { token } = await searchParams
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    notFound()
  }

  // Fetch job with relations
  const job = await db.query.jobs.findFirst({
    where: eq(schema.jobs.id, jobId),
    with: {
      customer: true,
      assignee: true,
    },
  })

  if (!job) {
    notFound()
  }

  // Validate feedback token for security
  // Only allow access if a valid token is provided
  if (!token || job.feedbackToken !== token) {
    notFound()
  }

  // Fetch company info
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, job.companyId),
  })

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    "in-progress": "bg-amber-100 text-amber-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-800",
  }

  const statusIcons: Record<string, React.ReactNode> = {
    scheduled: <Calendar className="h-5 w-5" />,
    "in-progress": <Clock className="h-5 w-5" />,
    completed: <CheckCircle className="h-5 w-5" />,
    cancelled: <span className="text-xl">❌</span>,
  }

  const currencySymbol = job.currency === "GBP" ? "£" : job.currency === "EUR" ? "€" : "$"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🧹</span>
            <h1 className="text-2xl font-bold text-gray-900">{company?.name || "Cleaning Service"}</h1>
          </div>
          <p className="text-gray-500">Job Details</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Banner */}
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${statusColors[job.status]} bg-opacity-20`}>
                  {statusIcons[job.status]}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{job.title}</h2>
                  <Badge className={statusColors[job.status]}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1).replace("-", " ")}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Estimated Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {job.estimatedPrice 
                    ? `${currencySymbol}${parseFloat(job.estimatedPrice).toFixed(2)}`
                    : "TBD"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Scheduling Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.scheduledFor ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(job.scheduledFor), "EEEE, MMMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(job.scheduledFor), "HH:mm")}
                      {job.scheduledEnd && ` - ${format(new Date(job.scheduledEnd), "HH:mm")}`}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Not yet scheduled</p>
              )}
              
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium text-gray-900">
                  {job.durationMinutes 
                    ? `${Math.floor(job.durationMinutes / 60)}h ${job.durationMinutes % 60}m`
                    : "Approximately 1 hour"
                  }
                </p>
              </div>

              {job.recurrence && job.recurrence !== "none" && (
                <div>
                  <p className="text-sm text-gray-500">Recurrence</p>
                  <Badge variant="outline" className="capitalize">{job.recurrence}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-500" />
                Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.location ? (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium text-gray-900">{job.location}</p>
                    {job.addressLine2 && <p className="text-gray-600">{job.addressLine2}</p>}
                    <p className="text-gray-600">
                      {[job.city, job.postcode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  
                  {job.accessInstructions && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-amber-800 mb-1">🔑 Access Instructions</p>
                      <p className="text-sm text-amber-700">{job.accessInstructions}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Location to be confirmed</p>
              )}
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-900">{job.description}</p>
                </div>
              )}

              {job.priority && job.priority !== "normal" && (
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <Badge 
                    variant="outline" 
                    className={
                      job.priority === "urgent" ? "border-red-500 text-red-600" :
                      job.priority === "high" ? "border-orange-500 text-orange-600" :
                      "border-gray-500 text-gray-600"
                    }
                  >
                    {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Cleaner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-purple-500" />
                Your Cleaner
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.assignee ? (
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-lg font-semibold text-purple-600">
                      {job.assignee.firstName.charAt(0)}{job.assignee.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {job.assignee.firstName} {job.assignee.lastName}
                    </p>
                    <p className="text-sm text-gray-500">Professional Cleaner</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">A cleaner will be assigned soon</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Completion Details (if completed) */}
        {job.status === "completed" && (
          <Card className="mt-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Job Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {job.completedAt && (
                <div>
                  <p className="text-sm text-green-600">Completed On</p>
                  <p className="font-medium text-green-800">
                    {format(new Date(job.completedAt), "EEEE, MMMM d, yyyy 'at' HH:mm")}
                  </p>
                </div>
              )}
              {job.actualPrice && (
                <div>
                  <p className="text-sm text-green-600">Final Price</p>
                  <p className="text-2xl font-bold text-green-800">
                    {currencySymbol}{parseFloat(job.actualPrice).toFixed(2)}
                  </p>
                </div>
              )}
              {job.qualityRating && (
                <div>
                  <p className="text-sm text-green-600">Quality Rating</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span 
                        key={i} 
                        className={`text-xl ${
                          i < Math.round(parseFloat(job.qualityRating!)) 
                            ? "text-yellow-400" 
                            : "text-gray-300"
                        }`}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Company Contact */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-gray-500" />
              Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              {company?.phone && (
                <a 
                  href={`tel:${company.phone}`} 
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <Phone className="h-4 w-4" />
                  {company.phone}
                </a>
              )}
              {company?.email && (
                <a 
                  href={`mailto:${company.email}`} 
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <Mail className="h-4 w-4" />
                  {company.email}
                </a>
              )}
            </div>
            {company?.address && (
              <p className="mt-4 text-gray-600 text-sm">{company.address}</p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Job Reference: #{job.id}</p>
          <p className="mt-1">
            © {new Date().getFullYear()} {company?.name || "Cleaning Service"}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
