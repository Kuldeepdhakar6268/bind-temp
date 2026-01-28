import { db } from "@/lib/db"
import { companies, customers, invoiceItems, invoices } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { generateInvoicePDF } from "@/lib/pdf-generator"

/**
 * Generate a PDF buffer for a given invoice within a company.
 * Throws if the database is unavailable or the invoice cannot be found.
 */
export async function generateInvoicePdfBuffer(invoiceId: number, companyId: number): Promise<Buffer> {
  if (!db) {
    throw new Error("Database not configured")
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
        eq(invoices.companyId, companyId),
      ),
    )
    .limit(1)

  if (!invoiceData) {
    throw new Error("Invoice not found")
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

  return Buffer.from(pdfDoc.output("arraybuffer"))
}

