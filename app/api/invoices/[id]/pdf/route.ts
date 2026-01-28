import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoiceItems, customers, companies } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuth } from "@/lib/auth"

// GET /api/invoices/[id]/pdf - Get invoice data for PDF generation
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth()
    const { id } = await context.params

    // Get invoice with all related data
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
          eq(invoices.id, parseInt(id)),
          eq(invoices.companyId, session.companyId)
        )
      )

    if (!invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Get invoice items
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, parseInt(id)))
      .orderBy(invoiceItems.sortOrder)

    // Format data for PDF generation
    const pdfData = {
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
    }

    return NextResponse.json(pdfData)
  } catch (error) {
    console.error("Error fetching invoice for PDF:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice data" },
      { status: 500 }
    )
  }
}

