import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoiceItems, customers, jobs, companies } from "@/lib/db/schema"
import { eq, and, desc, sql, or, like, gte, lte } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendInvoiceWithPDFEmail } from "@/lib/email"
import { generateInvoicePdfBuffer } from "@/lib/invoices-pdf"

// GET /api/invoices - List all invoices with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId

    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get("customerId")
    const jobId = searchParams.get("jobId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const fromDate = searchParams.get("fromDate")
    const toDate = searchParams.get("toDate")
    const limit = searchParams.get("limit")

    let query = db
      .select({
        invoice: invoices,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
        },
        job: {
          id: jobs.id,
          title: jobs.title,
        },
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(jobs, eq(invoices.jobId, jobs.id))
      .where(eq(invoices.companyId, session.companyId))
      .$dynamic()

    const conditions = []

    if (customerId) {
      conditions.push(eq(invoices.customerId, parseInt(customerId)))
    }

    if (jobId) {
      conditions.push(eq(invoices.jobId, parseInt(jobId)))
    }

    if (status) {
      // Support comma-separated statuses
      const statuses = status.split(",").map((s) => s.trim())
      if (statuses.length === 1) {
        conditions.push(eq(invoices.status, statuses[0]))
      } else {
        conditions.push(sql`${invoices.status} IN (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`)
      }
    }

    if (search) {
      conditions.push(
        or(
          like(invoices.invoiceNumber, `%${search}%`),
          like(customers.firstName, `%${search}%`),
          like(customers.lastName, `%${search}%`),
          like(customers.email, `%${search}%`)
        )
      )
    }

    if (fromDate) {
      conditions.push(gte(invoices.issuedAt, new Date(fromDate)))
    }

    if (toDate) {
      conditions.push(lte(invoices.issuedAt, new Date(toDate)))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    query = query.orderBy(desc(invoices.createdAt))

    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const results = await query

    // Transform results to match expected format
    const transformedResults = results.map((result) => ({
      id: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      customerId: result.invoice.customerId,
      customer: result.customer ? {
        id: result.customer.id,
        name: `${result.customer.firstName} ${result.customer.lastName}`,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName,
        email: result.customer.email,
      } : null,
      totalAmount: result.invoice.total,
      paidAmount: result.invoice.amountPaid,
      status: result.invoice.status,
      dueDate: result.invoice.dueAt,
      createdAt: result.invoice.createdAt,
    }))

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId

    const body = await request.json()
    const {
      customerId,
      jobId,
      items,
      taxRate,
      discountAmount,
      notes,
      terms,
      footer,
      dueAt,
    } = body

    if (dueAt) {
      const selectedDue = new Date(dueAt)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDue < today) {
        return NextResponse.json({ error: "Due date cannot be in the past" }, { status: 400 })
      }
    }

    // Generate invoice number
    const lastInvoice = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .orderBy(desc(invoices.id))
      .limit(1)

    const formatDate = (date: Date) => {
      const dd = String(date.getDate()).padStart(2, "0")
      const mm = String(date.getMonth() + 1).padStart(2, "0")
      const yyyy = date.getFullYear()
      return `${dd}-${mm}-${yyyy}`
    }

    let invoiceNumber = "INV-0001"
    if (lastInvoice.length > 0) {
      const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split("-")[1])
      invoiceNumber = `INV-${String(lastNumber + 1).padStart(4, "0")}`
    }

    const [customer] = await db
      .select({ firstName: customers.firstName, lastName: customers.lastName })
      .from(customers)
      .where(eq(customers.id, parseInt(customerId)))
      .limit(1)

    const [job] = jobId
      ? await db
          .select({ scheduledFor: jobs.scheduledFor })
          .from(jobs)
          .where(eq(jobs.id, parseInt(jobId)))
          .limit(1)
      : []

    const invoiceDate = job?.scheduledFor ? new Date(job.scheduledFor) : new Date()
    const customerNameLabel = customer
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : "Customer"
    invoiceNumber = `${invoiceNumber} - ${customerNameLabel} - ${formatDate(invoiceDate)}`

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.amount || 0),
      0
    )
    const taxAmount = (subtotal * parseFloat(taxRate || 0)) / 100
    const total = subtotal + taxAmount - parseFloat(discountAmount || 0)

    // Create invoice
    const [invoice] = await db
      .insert(invoices)
      .values({
        companyId,
        invoiceNumber,
        customerId: parseInt(customerId),
        jobId: jobId ? parseInt(jobId) : null,
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate || "0",
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount || "0",
        total: total.toFixed(2),
        amountDue: total.toFixed(2),
        notes,
        terms,
        footer,
        dueAt: dueAt ? new Date(dueAt) : null,
      })
      .returning()

    // Create invoice items
    if (items && items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item: any, index: number) => ({
          invoiceId: invoice.id,
          title: item.title,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          taxable: item.taxable !== false,
          sortOrder: index,
        }))
      )
    }

    // Get customer and company details to send invoice email
    const [customerDetails] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, parseInt(customerId)))
      .limit(1)

    const [companyDetails] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    // Send invoice email to customer
    if (customerDetails?.email) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
        const pdfBuffer = await generateInvoicePdfBuffer(invoice.id, companyId)

        await sendInvoiceWithPDFEmail({
          customerEmail: customerDetails.email,
          customerName: `${customerDetails.firstName} ${customerDetails.lastName}`,
          invoiceNumber: invoice.invoiceNumber,
          amount: total.toFixed(2),
          currency: "EUR",
          dueDate: invoice.dueAt ? new Date(invoice.dueAt) : new Date(),
          companyName: companyDetails?.name || "Cleaning Company",
          viewUrl: `${baseUrl}/portal/dashboard`,
          pdfBuffer,
        })
      } catch (emailError) {
        console.error("Failed to send invoice email:", emailError)
      }
    }

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    )
  }
}


