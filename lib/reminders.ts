import "server-only"

import { db } from "@/lib/db"
import { companies, customers, invoices, invoiceItems } from "@/lib/db/schema"
import { defaultReminderConfig, ReminderConfig } from "./reminders-config"
import { eq, and } from "drizzle-orm"
import { sendPaymentReminderEmail } from "./email"
import { generateInvoicePDF } from "./pdf-generator"

/**
 * Get invoices that need reminders sent
 */
export async function getInvoicesNeedingReminders(companyId: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get all unpaid invoices
  const unpaidInvoices = await db
    ?.select({
      invoice: invoices,
      customer: customers,
      company: companies,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .where(and(eq(invoices.companyId, companyId), eq(invoices.status, "sent")))

  if (!unpaidInvoices) return []

  const config = defaultReminderConfig

  const invoicesNeedingReminders = unpaidInvoices.filter((item) => {
    if (!item.invoice.dueAt) return false

    const dueDate = new Date(item.invoice.dueAt)
    dueDate.setHours(0, 0, 0, 0)

    const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Check if reminder should be sent before due date
    if (daysDiff > 0 && config.daysBeforeDue.includes(daysDiff)) {
      return true
    }

    // Check if reminder should be sent after due date
    if (daysDiff < 0 && config.daysAfterDue.includes(Math.abs(daysDiff))) {
      return true
    }

    return false
  })

  return invoicesNeedingReminders
}

/**
 * Generate reminder email content
 */
export function generateReminderEmail(
  invoice: any,
  customer: any,
  company: any,
  config: ReminderConfig = defaultReminderConfig,
) {
  const replacements: Record<string, string> = {
    "{invoiceNumber}": invoice.invoiceNumber,
    "{customerName}": customer.name || `${customer.firstName} ${customer.lastName}`,
    "{amount}": `GBP ${parseFloat(invoice.total).toFixed(2)}`,
    "{dueDate}": invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("en-GB") : "N/A",
    "{status}": invoice.status,
    "{companyName}": company.name,
    "{paymentInstructions}": company.paymentInstructions || "Please make payment at your earliest convenience.",
  }

  let subject = config.emailTemplate.subject
  let body = config.emailTemplate.body

  Object.entries(replacements).forEach(([key, value]) => {
    subject = subject.replace(new RegExp(key, "g"), value)
    body = body.replace(new RegExp(key, "g"), value)
  })

  return { subject, body }
}

/**
 * Send payment reminder
 * In a real implementation, this would integrate with an email service
 */
export async function sendPaymentReminder(invoiceId: number, customerId: number, companyId: number) {
  // Get invoice, customer, and company details
  const [result] = (await db
    ?.select({
      invoice: invoices,
      customer: customers,
      company: companies,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .where(eq(invoices.id, invoiceId))) || []

  if (!result) {
    throw new Error("Invoice not found")
  }

  const { invoice, customer, company } = result

  if (!customer?.email) {
    throw new Error("Customer email not found")
  }

  const { subject, body } = generateReminderEmail(invoice, customer, company)

  const items = await db
    ?.select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.sortOrder)

  const pdfDoc = generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt?.toISOString() || null,
    dueAt: invoice.dueAt?.toISOString() || null,
    status: invoice.status,
    company: {
      name: company?.name || "Company Name",
      email: company?.email || "",
      phone: company?.phone || null,
      address: company?.address || null,
      city: company?.city || null,
      postcode: company?.postcode || null,
    },
    customer: {
      name: customer?.name || `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
      email: customer?.email || "",
      phone: customer?.phone || null,
      address: customer?.address || null,
      city: customer?.city || null,
      postcode: customer?.postcode || null,
    },
    items: (items || []).map((item) => ({
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
    })),
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    discountAmount: invoice.discountAmount,
    total: invoice.total,
    notes: invoice.notes,
    terms: invoice.terms,
  })

  const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"))

  // Calculate days overdue
  const dueDate = invoice.dueAt ? new Date(invoice.dueAt) : new Date()
  const today = new Date()
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"

  // Send the reminder email
  try {
    await sendPaymentReminderEmail({
      customerEmail: customer.email,
      customerName: customer.name || `${customer.firstName} ${customer.lastName}`,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.total,
      currency: "EUR",
      dueDate,
      daysOverdue,
      companyName: company.name,
      paymentUrl: `${baseUrl}/portal/dashboard`,
      pdfBuffer,
    })
  } catch (emailError) {
    console.error("Failed to send reminder email:", emailError)
    throw new Error("Failed to send reminder email")
  }

  return {
    sent: true,
    to: customer.email,
    subject,
  }
}

/**
 * Process all reminders for a company
 */
export async function processReminders(companyId: number) {
  const invoicesNeedingReminders = await getInvoicesNeedingReminders(companyId)

  const results = []

  for (const item of invoicesNeedingReminders) {
    try {
      const result = await sendPaymentReminder(item.invoice.id, item.invoice.customerId, companyId)
      results.push({ invoiceId: item.invoice.id, success: true, result })
    } catch (error) {
      console.error(`Failed to send reminder for invoice ${item.invoice.id}:`, error)
      results.push({ invoiceId: item.invoice.id, success: false, error })
    }
  }

  return results
}

