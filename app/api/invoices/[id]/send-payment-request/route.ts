import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, customers, companies } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"
import { sendPaymentRequestEmail } from "@/lib/email"
import { generateInvoicePdfBuffer } from "@/lib/invoices-pdf"

/**
 * POST /api/invoices/[id]/send-payment-request
 * Send a payment request email to the customer with a payment link
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await requireAuth()
    const { id } = await params
    const invoiceId = parseInt(id)

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 })
    }

    // Get the invoice with customer info
    const [invoice] = await db
      .select({
        invoice: invoices,
        customer: {
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
        },
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.companyId, session.companyId)
        )
      )
      .limit(1)

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (!invoice.customer?.email) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 400 })
    }

    // Get company info
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1)

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"
    const paymentUrl = `${baseUrl}/portal/dashboard`
    let pdfBuffer: Buffer

    try {
      pdfBuffer = await generateInvoicePdfBuffer(invoiceId, session.companyId)
    } catch (pdfError) {
      console.error("Failed to generate invoice PDF for payment request:", pdfError)
      return NextResponse.json({ error: "Failed to generate invoice PDF" }, { status: 500 })
    }

    // Send the payment request email
    await sendPaymentRequestEmail({
      customerEmail: invoice.customer.email,
      customerName: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
      invoiceNumber: invoice.invoice.invoiceNumber,
      amount: invoice.invoice.total?.toString() || "0",
      currency: invoice.invoice.currency || "GBP",
      dueDate: invoice.invoice.dueAt || new Date(),
      companyName: company.name,
      paymentUrl,
      description: invoice.invoice.notes || "Cleaning service",
      pdfBuffer,
    })

    // Update invoice timestamp to track last activity
    await db
      .update(invoices)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))

    return NextResponse.json({
      success: true,
      message: `Payment request sent to ${invoice.customer.email}`,
    })
  } catch (error) {
    console.error("Error sending payment request:", error)
    return NextResponse.json(
      { error: "Failed to send payment request" },
      { status: 500 }
    )
  }
}
