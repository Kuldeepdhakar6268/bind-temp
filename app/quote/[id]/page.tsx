import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import QuoteViewClient from "./QuoteViewClient"

interface QuotePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; action?: string }>
}

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { id } = await params
  const { token, action } = await searchParams
  
  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Service temporarily unavailable</p>
      </div>
    )
  }

  const quoteId = parseInt(id)
  if (isNaN(quoteId)) {
    notFound()
  }

  // Get quote with all details
  const quote = await db.query.quotes.findFirst({
    where: eq(schema.quotes.id, quoteId),
    with: {
      customer: true,
      items: true,
    },
  })

  if (!quote) {
    notFound()
  }

  // Validate access token for security
  // Only allow access if a valid token is provided
  if (!token || quote.accessToken !== token) {
    notFound()
  }

  // Get company info
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, quote.companyId),
  })

  return (
    <QuoteViewClient 
      quote={quote} 
      company={company} 
      action={action}
    />
  )
}
