import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments, invoices } from "@/lib/db/schema"
import { eq, and, sum } from "drizzle-orm"
import { getSession } from "@/lib/auth"

// GET /api/payments/[id] - Get a single payment
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

    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, parseInt(id)),
          eq(payments.companyId, companyId)
        )
      )

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error fetching payment:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment" },
      { status: 500 }
    )
  }
}

// DELETE /api/payments/[id] - Delete a payment
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

    // Get payment to verify it exists
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, parseInt(id)),
          eq(payments.companyId, companyId)
        )
      )

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Delete payment
    await db.delete(payments).where(eq(payments.id, parseInt(id)))

    // Update invoice amounts
    const [paymentsSum] = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.invoiceId, payment.invoiceId))

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, payment.invoiceId))

    if (invoice) {
      const amountPaid = parseFloat(paymentsSum?.total || "0")
      const amountDue = parseFloat(invoice.total) - amountPaid

      await db
        .update(invoices)
        .set({
          amountPaid: amountPaid.toFixed(2),
          amountDue: amountDue.toFixed(2),
          status: amountDue > 0 ? "sent" : "paid",
          paidAt: amountDue <= 0 ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, payment.invoiceId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting payment:", error)
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    )
  }
}

