import { db } from "@/lib/db"
import { invoices, invoiceItems, jobs } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export interface GenerateInvoiceFromJobParams {
  companyId: number
  jobId: number
  taxRate?: number
  discountAmount?: number
  notes?: string
  terms?: string
  footer?: string
  dueInDays?: number
}

/**
 * Generate an invoice from a completed job
 */
export async function generateInvoiceFromJob(
  params: GenerateInvoiceFromJobParams
) {
  const {
    companyId,
    jobId,
    taxRate = 0,
    discountAmount = 0,
    notes,
    terms,
    footer,
    dueInDays = 30,
  } = params

  // Get job details
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId))

  if (!job) {
    throw new Error("Job not found")
  }

  if (!job.customerId) {
    throw new Error("Job must have a customer")
  }

  // Check if invoice already exists for this job
  const existingInvoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.jobId, jobId))
    .limit(1)

  if (existingInvoice.length > 0) {
    throw new Error("Invoice already exists for this job")
  }

  // Generate invoice number
  const lastInvoice = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(eq(invoices.companyId, companyId))
    .orderBy(desc(invoices.id))
    .limit(1)

  let invoiceNumber = "INV-0001"
  if (lastInvoice.length > 0) {
    const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split("-")[1])
    invoiceNumber = `INV-${String(lastNumber + 1).padStart(4, "0")}`
  }

  // Calculate amounts
  const subtotal = parseFloat(job.actualPrice || job.estimatedPrice || "0")
  const taxAmount = (subtotal * taxRate) / 100
  const total = subtotal + taxAmount - discountAmount

  // Calculate due date
  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + dueInDays)

  // Create invoice
  const [invoice] = await db
    .insert(invoices)
    .values({
      companyId,
      invoiceNumber,
      customerId: job.customerId,
      jobId: job.id,
      subtotal: subtotal.toFixed(2),
      taxRate: taxRate.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      total: total.toFixed(2),
      amountDue: total.toFixed(2),
      status: "draft",
      issuedAt: new Date(),
      dueAt,
      notes: notes || `Invoice for ${job.title}`,
      terms:
        terms ||
        `Payment is due within ${dueInDays} days of the invoice date.`,
      footer: footer || "Thank you for your business!",
    })
    .returning()

  // Create invoice item from job
  await db.insert(invoiceItems).values({
    invoiceId: invoice.id,
    title: job.title || "Cleaning Service",
    description: job.description || "",
    quantity: "1",
    unitPrice: subtotal.toFixed(2),
    amount: subtotal.toFixed(2),
    taxable: true,
    sortOrder: 0,
  })

  return invoice
}

/**
 * Update invoice status based on due date
 */
export async function updateOverdueInvoices(companyId: number) {
  const now = new Date()

  await db
    .update(invoices)
    .set({
      status: "overdue",
      updatedAt: new Date(),
    })
    .where(
      eq(invoices.companyId, companyId),
      eq(invoices.status, "sent"),
      // dueAt < now and amountDue > 0
    )

  return true
}

/**
 * Calculate invoice totals from items
 */
export function calculateInvoiceTotals(
  items: Array<{ quantity: string; unitPrice: string; taxable?: boolean }>,
  taxRate: number = 0,
  discountAmount: number = 0
) {
  const subtotal = items.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity || "0")
    const unitPrice = parseFloat(item.unitPrice || "0")
    return sum + quantity * unitPrice
  }, 0)

  const taxableAmount = items
    .filter((item) => item.taxable !== false)
    .reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || "0")
      const unitPrice = parseFloat(item.unitPrice || "0")
      return sum + quantity * unitPrice
    }, 0)

  const taxAmount = (taxableAmount * taxRate) / 100
  const total = subtotal + taxAmount - discountAmount

  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  }
}

