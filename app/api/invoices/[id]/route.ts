import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { invoices, invoiceItems, payments, customers, jobs } from "@/lib/db/schema"
import { eq, and, sum } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/invoices/[id] - Get a single invoice with items and payments
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId
    const { id } = await context.params

    const [invoice] = await db
      .select({
        invoice: invoices,
        customer: customers,
        job: jobs,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .leftJoin(jobs, eq(invoices.jobId, jobs.id))
      .where(
        and(
          eq(invoices.id, parseInt(id)),
          eq(invoices.companyId, companyId)
        )
      )

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Get invoice items
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, parseInt(id)))
      .orderBy(invoiceItems.sortOrder)

    // Get payments
    const invoicePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, parseInt(id)))

    return NextResponse.json({
      ...invoice,
      items,
      payments: invoicePayments,
    })
  } catch (error) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    )
  }
}

// PUT /api/invoices/[id] - Update an invoice
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId
    const { id } = await context.params
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
      status,
      issuedAt,
      dueAt,
    } = body

    // Verify invoice belongs to company
    const [existing] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, parseInt(id)),
          eq(invoices.companyId, companyId)
        )
      )

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.amount || 0),
      0
    )
    const taxAmount = (subtotal * parseFloat(taxRate || 0)) / 100
    const total = subtotal + taxAmount - parseFloat(discountAmount || 0)

    // Get total payments
    const [paymentsSum] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.invoiceId, parseInt(id)))

    const amountPaid = parseFloat(paymentsSum?.total || "0")
    const amountDue = total - amountPaid

    // Update invoice
    const [updated] = await db
      .update(invoices)
      .set({
        customerId: customerId ? parseInt(customerId) : existing.customerId,
        jobId: jobId ? parseInt(jobId) : null,
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate || "0",
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount || "0",
        total: total.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        amountDue: amountDue.toFixed(2),
        status: status || existing.status,
        issuedAt: issuedAt ? new Date(issuedAt) : existing.issuedAt,
        dueAt: dueAt ? new Date(dueAt) : existing.dueAt,
        paidAt: amountDue <= 0 ? new Date() : null,
        notes,
        terms,
        footer,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, parseInt(id)))
      .returning()

    // Delete existing items and recreate
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, parseInt(id)))

    if (items && items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item: any, index: number) => ({
          invoiceId: parseInt(id),
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

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    )
  }
}

// DELETE /api/invoices/[id] - Delete an invoice
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const companyId = session.companyId
    const { id } = await context.params

    // Verify invoice belongs to company
    const [existing] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, parseInt(id)),
          eq(invoices.companyId, companyId)
        )
      )

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Delete invoice (cascade will delete items and payments)
    await db.delete(invoices).where(eq(invoices.id, parseInt(id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    )
  }
}

