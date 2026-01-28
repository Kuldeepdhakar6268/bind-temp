import { Suspense } from "react"
import BookingPageClient from "./booking-page"

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <BookingPageClient />
    </Suspense>
  )
}
