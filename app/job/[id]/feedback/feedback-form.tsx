"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Star, CheckCircle } from "lucide-react"

interface FeedbackFormProps {
  jobId: number
  jobTitle: string
  customerName: string
  cleanerName: string | null
  completedAt: string | null
  existingRating: number | null
  existingFeedback: string | null
  companyName: string
}

export function FeedbackForm({
  jobId,
  jobTitle,
  customerName,
  cleanerName,
  completedAt,
  existingRating,
  existingFeedback,
  companyName,
}: FeedbackFormProps) {
  const [rating, setRating] = useState(existingRating || 0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState(existingFeedback || "")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingRating)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a rating")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/public/jobs/${jobId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to submit feedback")
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback")
    } finally {
      setLoading(false)
    }
  }

  if (submitted && !existingRating) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800 mb-2">Thank You!</h2>
          <p className="text-green-700 mb-6">
            Your feedback has been submitted successfully. We really appreciate you taking the time to share your thoughts!
          </p>
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-8 w-8 ${
                  i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                }`}
              />
            ))}
          </div>
          {feedback && (
            <p className="text-gray-600 italic max-w-md mx-auto">"{feedback}"</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          {existingRating ? "Your Feedback" : "How Did We Do?"}
        </CardTitle>
        <CardDescription>
          {existingRating 
            ? "Thank you for your feedback!"
            : "We'd love to hear about your experience"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">{jobTitle}</h3>
          {completedAt && (
            <p className="text-sm text-gray-500">Completed on {completedAt}</p>
          )}
          {cleanerName && (
            <p className="text-sm text-gray-500">Cleaned by {cleanerName}</p>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rate your experience
          </label>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                disabled={loading || !!existingRating}
                onClick={() => setRating(i + 1)}
                onMouseEnter={() => setHoveredRating(i + 1)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110 disabled:cursor-default"
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    i < (hoveredRating || rating)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent!"}
          </div>
        </div>

        {/* Feedback Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tell us more (optional)
          </label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What did you like? What could we improve?"
            rows={4}
            disabled={loading || !!existingRating}
            className="resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Submit */}
        {!existingRating && (
          <Button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center">
          Your feedback helps us improve our service. Thank you for choosing {companyName}!
        </p>
      </CardContent>
    </Card>
  )
}
