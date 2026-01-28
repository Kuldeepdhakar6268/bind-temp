import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface InvoiceData {
  invoiceNumber: string
  issuedAt: string | null
  dueAt: string | null
  status: string
  company: {
    name: string
    email: string
    phone?: string | null
    address?: string | null
    city?: string | null
    postcode?: string | null
  }
  customer: {
    name: string
    email: string
    phone?: string | null
    address?: string | null
    city?: string | null
    postcode?: string | null
  }
  items: Array<{
    title: string
    description?: string | null
    quantity: string
    unitPrice: string
    amount: string
  }>
  subtotal: string
  taxRate: string
  taxAmount: string
  discountAmount: string
  total: string
  notes?: string | null
  terms?: string | null
}

/**
 * Generate a professional PDF invoice
 */
export function generateInvoicePDF(invoice: InvoiceData): jsPDF {
  const doc = new jsPDF()
  
  // Colors
  const primaryColor: [number, number, number] = [79, 70, 229] // Indigo
  const textColor: [number, number, number] = [26, 26, 26]
  const lightGray: [number, number, number] = [245, 245, 245]
  
  let yPos = 20

  // Header - Company Name
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text(invoice.company.name, 20, yPos)
  
  yPos += 10
  
  // Company Details
  doc.setFontSize(10)
  doc.setTextColor(...textColor)
  doc.setFont("helvetica", "normal")
  if (invoice.company.email) doc.text(invoice.company.email, 20, yPos)
  yPos += 5
  if (invoice.company.phone) doc.text(invoice.company.phone, 20, yPos)
  yPos += 5
  if (invoice.company.address) {
    doc.text(invoice.company.address, 20, yPos)
    yPos += 5
  }
  if (invoice.company.city || invoice.company.postcode) {
    doc.text(`${invoice.company.city || ""} ${invoice.company.postcode || ""}`.trim(), 20, yPos)
    yPos += 5
  }

  // Invoice Title and Number (Right side)
  doc.setFontSize(28)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", 200, 20, { align: "right" })
  
  doc.setFontSize(12)
  doc.setTextColor(...textColor)
  doc.setFont("helvetica", "normal")
  doc.text(invoice.invoiceNumber, 200, 30, { align: "right" })

  // Status Badge
  const statusColors: Record<string, [number, number, number]> = {
    draft: [156, 163, 175],
    sent: [59, 130, 246],
    paid: [34, 197, 94],
    overdue: [239, 68, 68],
    cancelled: [107, 114, 128],
  }
  const statusColor = statusColors[invoice.status] || statusColors.draft
  doc.setFillColor(...statusColor)
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  const statusText = invoice.status.toUpperCase()
  const statusWidth = doc.getTextWidth(statusText) + 8
  doc.roundedRect(200 - statusWidth, 35, statusWidth, 7, 2, 2, "F")
  doc.text(statusText, 200 - statusWidth / 2, 40, { align: "center" })

  yPos = Math.max(yPos, 50)

  // Bill To Section
  doc.setFontSize(12)
  doc.setTextColor(...textColor)
  doc.setFont("helvetica", "bold")
  doc.text("Bill To:", 20, yPos)
  yPos += 7
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(invoice.customer.name, 20, yPos)
  yPos += 5
  if (invoice.customer.email) {
    doc.text(invoice.customer.email, 20, yPos)
    yPos += 5
  }
  if (invoice.customer.phone) {
    doc.text(invoice.customer.phone, 20, yPos)
    yPos += 5
  }
  if (invoice.customer.address) {
    doc.text(invoice.customer.address, 20, yPos)
    yPos += 5
  }
  if (invoice.customer.city || invoice.customer.postcode) {
    doc.text(`${invoice.customer.city || ""} ${invoice.customer.postcode || ""}`.trim(), 20, yPos)
    yPos += 5
  }

  // Invoice Details (Right side)
  const detailsX = 120
  let detailsY = 50
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  
  if (invoice.issuedAt) {
    doc.text("Issue Date:", detailsX, detailsY)
    doc.setFont("helvetica", "normal")
    doc.text(new Date(invoice.issuedAt).toLocaleDateString(), detailsX + 30, detailsY)
    detailsY += 6
  }
  
  if (invoice.dueAt) {
    doc.setFont("helvetica", "bold")
    doc.text("Due Date:", detailsX, detailsY)
    doc.setFont("helvetica", "normal")
    doc.text(new Date(invoice.dueAt).toLocaleDateString(), detailsX + 30, detailsY)
    detailsY += 6
  }

  yPos = Math.max(yPos, detailsY) + 10

  // Line Items Table
  const tableData = invoice.items.map((item) => [
    item.title + (item.description ? `\n${item.description}` : ""),
    item.quantity,
    `£${parseFloat(item.unitPrice).toFixed(2)}`,
    `£${parseFloat(item.amount).toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
  })

  // Get Y position after table
  yPos = (doc as any).lastAutoTable.finalY + 10

  // Totals Section (Right aligned)
  const totalsX = 140
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  
  doc.text("Subtotal:", totalsX, yPos)
  doc.text(`£${parseFloat(invoice.subtotal).toFixed(2)}`, 200, yPos, { align: "right" })
  yPos += 6

  if (parseFloat(invoice.taxRate) > 0) {
    doc.text(`Tax (${invoice.taxRate}%):`, totalsX, yPos)
    doc.text(`£${parseFloat(invoice.taxAmount).toFixed(2)}`, 200, yPos, { align: "right" })
    yPos += 6
  }

  if (parseFloat(invoice.discountAmount) > 0) {
    doc.text("Discount:", totalsX, yPos)
    doc.text(`-£${parseFloat(invoice.discountAmount).toFixed(2)}`, 200, yPos, { align: "right" })
    yPos += 6
  }

  // Total
  doc.setDrawColor(...primaryColor)
  doc.setLineWidth(0.5)
  doc.line(totalsX, yPos, 200, yPos)
  yPos += 7
  
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("Total:", totalsX, yPos)
  doc.text(`£${parseFloat(invoice.total).toFixed(2)}`, 200, yPos, { align: "right" })

  yPos += 15

  // Notes
  if (invoice.notes) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Notes:", 20, yPos)
    yPos += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const notesLines = doc.splitTextToSize(invoice.notes, 170)
    doc.text(notesLines, 20, yPos)
    yPos += notesLines.length * 5 + 5
  }

  // Terms
  if (invoice.terms) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Payment Terms:", 20, yPos)
    yPos += 6
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    const termsLines = doc.splitTextToSize(invoice.terms, 170)
    doc.text(termsLines, 20, yPos)
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} | ${invoice.company.name}`,
    105,
    285,
    { align: "center" }
  )

  return doc
}

/**
 * Download invoice as PDF
 */
export function downloadInvoicePDF(invoice: InvoiceData) {
  const doc = generateInvoicePDF(invoice)
  doc.save(`${invoice.invoiceNumber}.pdf`)
}

interface ContractPdfData {
  contractNumber: string
  title: string
  description?: string | null
  frequency?: string | null
  amount: string
  billingFrequency?: string | null
  startDate: string | null
  endDate?: string | null
  autoRenew: boolean
  status: string
  terms?: string | null
  notes?: string | null
  company: {
    name: string
  }
  customer: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    postcode?: string | null
  }
}

export function generateContractPDF(contract: ContractPdfData): jsPDF {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.text("SERVICE CONTRACT", 105, 20, { align: "center" })

  doc.setFontSize(12)
  doc.text(contract.company.name, 20, 30)
  doc.text(`Contract Number: ${contract.contractNumber}`, 20, 40)

  doc.setFontSize(14)
  doc.text("Contract Details", 20, 55)
  doc.setFontSize(11)
  doc.text(`Service: ${contract.title}`, 20, 65)
  doc.text(`Description: ${contract.description || "N/A"}`, 20, 72)
  doc.text(`Frequency: ${contract.frequency || "N/A"}`, 20, 79)
  doc.text(`Amount: ?${parseFloat(contract.amount || "0").toFixed(2)}`, 20, 86)
  doc.text(`Billing: ${contract.billingFrequency || "Monthly"}`, 20, 93)
  doc.text(`Start Date: ${contract.startDate ? new Date(contract.startDate).toLocaleDateString("en-GB") : "N/A"}`, 20, 103)
  doc.text(`End Date: ${contract.endDate ? new Date(contract.endDate).toLocaleDateString("en-GB") : "Rolling"}`, 20, 110)
  doc.text(`Auto-Renew: ${contract.autoRenew ? "Yes" : "No"}`, 20, 117)
  doc.text(`Status: ${contract.status.toUpperCase()}`, 20, 124)

  doc.setFontSize(14)
  doc.text("Customer Information", 20, 140)
  doc.setFontSize(11)
  doc.text(`Name: ${contract.customer.name}`, 20, 150)
  if (contract.customer.email) doc.text(`Email: ${contract.customer.email}`, 20, 157)
  if (contract.customer.phone) doc.text(`Phone: ${contract.customer.phone}`, 20, 164)
  if (contract.customer.address) {
    doc.text(`Address: ${contract.customer.address}`, 20, 171)
    doc.text(`${contract.customer.city || ""} ${contract.customer.postcode || ""}`.trim(), 20, 178)
  }

  if (contract.terms) {
    doc.setFontSize(14)
    doc.text("Terms & Conditions", 20, 195)
    doc.setFontSize(10)
    const splitTerms = doc.splitTextToSize(contract.terms, 170)
    doc.text(splitTerms, 20, 205)
  }

  if (contract.notes) {
    doc.setFontSize(12)
    doc.text("Notes", 20, 240)
    doc.setFontSize(10)
    const splitNotes = doc.splitTextToSize(contract.notes, 170)
    doc.text(splitNotes, 20, 248)
  }

  doc.setFontSize(9)
  doc.text(`Generated on ${new Date().toLocaleDateString("en-GB")}`, 20, 280)

  return doc
}

