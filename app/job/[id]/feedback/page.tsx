import { Metadata } from "next"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { FeedbackForm } from "./feedback-form"

export const metadata: Metadata = {
  title: "Leave Feedback",
  description: "Share your feedback about your cleaning service",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobFeedbackPage({ params }: PageProps) {
  const { id } = await params
  const jobId = parseInt(id)

  if (isNaN(jobId)) {
    notFound()
  }

  // Fetch job
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

  // Fetch company info
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, job.companyId),
  })

  // Check if already has feedback
  const hasFeedback = job.customerFeedback || job.qualityRating

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🧹</span>
            <h1 className="text-2xl font-bold text-gray-900">{company?.name || "Cleaning Service"}</h1>
          </div>
          <p className="text-gray-500">Share Your Feedback</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <FeedbackForm 
          jobId={job.id}
          jobTitle={job.title}
          customerName={job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : ""}
          cleanerName={job.assignee ? `${job.assignee.firstName} ${job.assignee.lastName}` : null}
          completedAt={job.completedAt ? new Date(job.completedAt).toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric", 
            month: "long",
            day: "numeric",
          }) : null}
          existingRating={job.qualityRating ? parseFloat(job.qualityRating) : null}
          existingFeedback={job.customerFeedback}
          companyName={company?.name || "Cleaning Service"}
        />
      </div>
    </div>
  )
}
