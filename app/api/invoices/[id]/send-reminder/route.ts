import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoiceItems, customers, companies } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"
import { sendPaymentReminderEmail } from "@/lib/email"
import { generateInvoicePDF } from "@/lib/pdf-generator"

// POST /api/invoices/[id]/send-reminder - Send payment reminder with PDF
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

    const [invoiceData] = await db
      .select({
        invoice: invoices,
        customer: customers,
        company: companies,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.companyId, session.companyId)
        )
      )

    if (!invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (!invoiceData.customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(invoiceItems.sortOrder)

    const pdfDoc = generateInvoicePDF({
      invoiceNumber: invoiceData.invoice.invoiceNumber,
      issuedAt: invoiceData.invoice.issuedAt?.toISOString() || null,
      dueAt: invoiceData.invoice.dueAt?.toISOString() || null,
      status: invoiceData.invoice.status,
      company: {
        name: invoiceData.company?.name || "Company Name",
        email: invoiceData.company?.email || "",
        phone: invoiceData.company?.phone || null,
        address: invoiceData.company?.address || null,
        city: invoiceData.company?.city || null,
        postcode: invoiceData.company?.postcode || null,
      },
      customer: {
        name: invoiceData.customer
          ? `${invoiceData.customer.firstName || ""} ${invoiceData.customer.lastName || ""}`.trim()
          : "Customer Name",
        email: invoiceData.customer?.email || "",
        phone: invoiceData.customer?.phone || null,
        address: invoiceData.customer?.address || null,
        city: invoiceData.customer?.city || null,
        postcode: invoiceData.customer?.postcode || null,
      },
      items: items.map((item) => ({
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      subtotal: invoiceData.invoice.subtotal,
      taxRate: invoiceData.invoice.taxRate,
      taxAmount: invoiceData.invoice.taxAmount,
      discountAmount: invoiceData.invoice.discountAmount,
      total: invoiceData.invoice.total,
      notes: invoiceData.invoice.notes,
      terms: invoiceData.invoice.terms,
    })

    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"))

    // Calculate days overdue
    const dueDate = invoiceData.invoice.dueAt ? new Date(invoiceData.invoice.dueAt) : new Date()
    const today = new Date()
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"

    await sendPaymentReminderEmail({
      customerEmail: invoiceData.customer.email,
      customerName: `${invoiceData.customer.firstName || ""} ${invoiceData.customer.lastName || ""}`.trim() || "Customer",
      invoiceNumber: invoiceData.invoice.invoiceNumber,
      amount: invoiceData.invoice.total,
      currency: "EUR",
      dueDate,
      daysOverdue,
      companyName: invoiceData.company?.name || "Company",
      paymentUrl: `${baseUrl}/portal/dashboard`,
      pdfBuffer,
    })

    return NextResponse.json({
      success: true,
      customerName: `${invoiceData.customer.firstName || ""} ${invoiceData.customer.lastName || ""}`.trim() || "Customer",
      customerEmail: invoiceData.customer.email,
      invoiceNumber: invoiceData.invoice.invoiceNumber,
    })
  } catch (error) {
    console.error("Send invoice reminder error:", error)
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 })
  }
}
