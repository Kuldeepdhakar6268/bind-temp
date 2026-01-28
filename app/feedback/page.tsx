"use client"

import { useEffect, useState } from "react"
import { DashboardHeaderClient } from "@/components/dashboard-header-client"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, MessageSquare, ThumbsUp, AlertCircle, RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface FeedbackItem {
  id: number
  jobId: number
  jobTitle: string
  customer: { id: number; name: string } | null
  assignee: { id: number; name: string } | null
  rating: string | null
  feedback: string | null
  completedAt: string | null
}

interface FeedbackSummary {
  totalFeedback: number
  averageRating: number | null
  ratingDistribution: {
    excellent: number
    good: number
    average: number
    poor: number
  }
}

export default function FeedbackPage() {
  const [loading, setLoading] = useState(true)
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([])
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)

  useEffect(() => {
    loadFeedback()
  }, [])

  const loadFeedback = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/feedback")
      const data = await response.json()
      setFeedbackData(data.feedback || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error("Failed to load feedback:", error)
    } finally {
      setLoading(false)
    }
  }

  const feedbackStats = [
    { 
      label: "Average Rating", 
      value: summary?.averageRating?.toFixed(1) || "N/A", 
      icon: Star, 
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10"
    },
    { 
      label: "Total Reviews", 
      value: summary?.totalFeedback?.toString() || "0", 
      icon: MessageSquare, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    { 
      label: "Positive", 
      value: summary ? `${Math.round(((summary.ratingDistribution.excellent + summary.ratingDistribution.good) / Math.max(summary.totalFeedback, 1)) * 100)}%` : "N/A", 
      icon: ThumbsUp, 
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    { 
      label: "Needs Attention", 
      value: (summary?.ratingDistribution.poor || 0).toString(), 
      icon: AlertCircle, 
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeaderClient />
        <main className="p-4 md:p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Feedback</h1>
            <p className="text-muted-foreground mt-1">Monitor ratings, reviews, and customer satisfaction</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeaderClient />

      <main className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Feedback</h1>
            <p className="text-muted-foreground mt-1">Monitor ratings, reviews, and customer satisfaction</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadFeedback}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {feedbackStats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${stat.bgColor} rounded-lg`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Reviews</h3>
          
          {feedbackData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feedback received yet.</p>
              <p className="text-sm mt-1">Customer feedback will appear here after jobs are completed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackData.map((item) => {
                const rating = item.rating ? parseFloat(item.rating) : 0
                return (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{item.customer?.name || "Unknown Customer"}</h4>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {item.assignee && <span>Staff: {item.assignee.name}</span>}
                          <span>Job: {item.jobTitle}</span>
                          {item.completedAt && (
                            <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          rating >= 4
                            ? "bg-green-500/10 text-green-700"
                            : rating >= 3
                              ? "bg-yellow-500/10 text-yellow-700"
                              : "bg-red-500/10 text-red-700"
                        }
                      >
                        {rating >= 4 ? "Positive" : rating >= 3 ? "Neutral" : "Negative"}
                      </Badge>
                    </div>

                    {item.feedback && <p className="text-sm">{item.feedback}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
