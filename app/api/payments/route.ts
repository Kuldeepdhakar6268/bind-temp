import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments, invoices, customers, companies } from "@/lib/db/schema"
import { eq, and, desc, sum } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendPaymentReceiptEmail } from "@/lib/email"

// GET /api/payments - List all payments
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId
    const searchParams = request.nextUrl.searchParams
    const invoiceId = searchParams.get("invoiceId")
    const customerId = searchParams.get("customerId")
    const limit = searchParams.get("limit")
    const sort = searchParams.get("sort")

    let query = db
      .select({
        payment: payments,
        invoice: {
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
        },
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
        },
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(customers, eq(payments.customerId, customers.id))
      .where(eq(payments.companyId, companyId))
      .$dynamic()

    const conditions = []

    if (invoiceId) {
      conditions.push(eq(payments.invoiceId, parseInt(invoiceId)))
    }

    if (customerId) {
      conditions.push(eq(payments.customerId, parseInt(customerId)))
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    query = query.orderBy(desc(payments.paidAt))

    if (limit) {
      query = query.limit(parseInt(limit))
    }

    const results = await query

    // Transform results to match expected format
    const transformedResults = results.map((result) => ({
      id: result.payment.id,
      invoiceId: result.payment.invoiceId,
      invoice: result.invoice
        ? {
            invoiceNumber: result.invoice.invoiceNumber,
            customer: result.customer ? {
              id: result.customer.id,
              name: `${result.customer.firstName} ${result.customer.lastName}`,
              firstName: result.customer.firstName,
              lastName: result.customer.lastName,
            } : null,
          }
        : undefined,
      amount: result.payment.amount,
      paymentMethod: result.payment.method,
      paidAt: result.payment.paidAt,
    }))

    return NextResponse.json(transformedResults)
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}

// POST /api/payments - Record a new payment
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId
    const body = await request.json()
    const {
      invoiceId,
      customerId,
      amount,
      paymentMethod,
      method,
      transactionId,
      reference,
      notes,
      paymentDate,
      paidAt,
    } = body

    // Get invoice to verify it exists and get customer
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, parseInt(invoiceId)),
          eq(invoices.companyId, companyId)
        )
      )

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Create payment
    const [payment] = await db
      .insert(payments)
      .values({
        companyId,
        invoiceId: parseInt(invoiceId),
        customerId: customerId ? parseInt(customerId) : invoice.customerId,
        amount: parseFloat(amount).toFixed(2),
        currency: invoice.currency,
        method: paymentMethod || method || "cash",
        transactionId,
        reference,
        notes,
        paidAt: paymentDate ? new Date(paymentDate) : (paidAt ? new Date(paidAt) : new Date()),
      })
      .returning()

    // Update invoice amounts
    const [paymentsSum] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.invoiceId, parseInt(invoiceId)))

    const amountPaid = parseFloat(paymentsSum?.total || "0")
    const amountDue = parseFloat(invoice.total) - amountPaid

    await db
      .update(invoices)
      .set({
        amountPaid: amountPaid.toFixed(2),
        amountDue: amountDue.toFixed(2),
        status: amountDue <= 0 ? "paid" : invoice.status,
        paidAt: amountDue <= 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, parseInt(invoiceId)))

    // Get customer and company info to send payment receipt email
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1)

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1)

    // Send payment receipt email to customer
    if (customer?.email) {
      try {
        await sendPaymentReceiptEmail(
          customer.email,
          `${customer.firstName} ${customer.lastName}`,
          company?.name || "Our cleaning team",
          invoice.invoiceNumber,
          parseFloat(amount),
          paymentMethod || method || "cash",
          payment.paidAt || new Date(),
          amountDue
        )
      } catch (emailError) {
        console.error("Failed to send payment receipt email:", emailError)
      }
    }

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    )
  }
}


