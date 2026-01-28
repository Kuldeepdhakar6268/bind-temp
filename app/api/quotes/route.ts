import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/quotes - List all quotes for the company with filtering
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const customerId = searchParams.get("customerId")
    const search = searchParams.get("search")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") || "desc"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    // Build conditions
    const conditions = [eq(schema.quotes.companyId, session.companyId)]
    
    if (status && status !== "all") {
      if (status === "pending") {
        // Pending includes sent quotes awaiting response
        conditions.push(or(
          eq(schema.quotes.status, "sent"),
          eq(schema.quotes.status, "pending")
        )!)
      } else {
        conditions.push(eq(schema.quotes.status, status))
      }
    }
    
    if (customerId) {
      conditions.push(eq(schema.quotes.customerId, parseInt(customerId)))
    }
    
    if (startDate) {
      conditions.push(gte(schema.quotes.createdAt, new Date(startDate)))
    }
    
    if (endDate) {
      conditions.push(lte(schema.quotes.createdAt, new Date(endDate)))
    }

    // Get quotes with relations
    let quotes = await db.query.quotes.findMany({
      where: and(...conditions),
      with: {
        customer: true,
        items: true,
      },
      orderBy: sortOrder === "asc" 
        ? [schema.quotes[sortBy as keyof typeof schema.quotes] as any]
        : [desc(schema.quotes[sortBy as keyof typeof schema.quotes] as any)],
    })

    // Apply search filter (after query due to customer name)
    if (search) {
      const searchLower = search.toLowerCase()
      quotes = quotes.filter(q => {
        const customer = q.customer as any
        const customerName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.toLowerCase() : ''
        const customerEmail = customer?.email?.toLowerCase() || ''
        return q.quoteNumber.toLowerCase().includes(searchLower) ||
          q.title.toLowerCase().includes(searchLower) ||
          customerName.includes(searchLower) ||
          customerEmail.includes(searchLower)
      })
    }

    // Calculate summary stats
    const summary = {
      total: quotes.length,
      draft: quotes.filter(q => q.status === "draft").length,
      sent: quotes.filter(q => q.status === "sent").length,
      accepted: quotes.filter(q => q.status === "accepted").length,
      rejected: quotes.filter(q => q.status === "rejected").length,
      converted: quotes.filter(q => q.status === "converted").length,
      totalValue: quotes.reduce((sum, q) => sum + parseFloat(q.total || "0"), 0),
      acceptedValue: quotes.filter(q => q.status === "accepted" || q.status === "converted")
        .reduce((sum, q) => sum + parseFloat(q.total || "0"), 0),
      pendingValue: quotes.filter(q => q.status === "sent" || q.status === "pending")
        .reduce((sum, q) => sum + parseFloat(q.total || "0"), 0),
    }

    // Paginate
    const totalCount = quotes.length
    const offset = (page - 1) * limit
    const paginatedQuotes = quotes.slice(offset, offset + limit)

    // Add computed fields
    const enrichedQuotes = paginatedQuotes.map(q => ({
      ...q,
      isExpired: q.validUntil ? new Date(q.validUntil) < new Date() : false,
      daysSinceSent: q.sentAt 
        ? Math.floor((Date.now() - new Date(q.sentAt).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))

    return NextResponse.json({
      quotes: enrichedQuotes,
      summary,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching quotes:", error)
    return NextResponse.json({ error: "Failed to fetch quotes" }, { status: 500 })
  }
}

// POST /api/quotes - Create a new quote
export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      customerId,
      title,
      description,
      items,
      validUntil,
      notes,
      terms,
    } = body

    if (!customerId || !title) {
      return NextResponse.json({ error: "Customer and title are required" }, { status: 400 })
    }

    // Generate quote number
    const existingQuotes = await db.query.quotes.findMany({
      where: eq(schema.quotes.companyId, session.companyId),
    })
    const quoteNumber = `Q-${new Date().getFullYear()}-${String(existingQuotes.length + 1).padStart(4, "0")}`

    // Calculate totals
    const subtotal = items?.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0) || 0
    const taxRate = body.taxRate || 0
    const taxAmount = subtotal * (taxRate / 100)
    const discountAmount = body.discountAmount || 0
    const total = subtotal + taxAmount - discountAmount

    const [quote] = await db
      .insert(schema.quotes)
      .values({
        companyId: session.companyId,
        customerId,
        quoteNumber,
        title,
        description,
        subtotal: subtotal.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        total: total.toString(),
        validUntil: validUntil ? new Date(validUntil) : null,
        notes,
        terms,
        status: "draft",
      })
      .returning()

    // Insert quote items
    if (items && items.length > 0) {
      await db.insert(schema.quoteItems).values(
        items.map((item: any, index: number) => ({
          quoteId: quote.id,
          title: item.title,
          description: item.description,
          quantity: item.quantity?.toString() || "1",
          unitPrice: item.unitPrice?.toString() || "0",
          amount: item.amount?.toString() || "0",
          sortOrder: index,
        }))
      )
    }

    return NextResponse.json(quote, { status: 201 })
  } catch (error) {
    console.error("Error creating quote:", error)
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 })
  }
}

