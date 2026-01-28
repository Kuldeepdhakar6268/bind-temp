import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { processReminders } from "@/lib/reminders"

// POST /api/reminders/process - Process and send payment reminders
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Process reminders for the company
    const results = await processReminders(session.companyId)

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      processed: results.length,
      sent: successCount,
      failed: failureCount,
      results,
    })
  } catch (error: any) {
    console.error("Error processing reminders:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process reminders" },
      { status: 500 }
    )
  }
}

// GET /api/reminders/process - Preview invoices that need reminders
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { getInvoicesNeedingReminders } = await import("@/lib/reminders")

    const invoices = await getInvoicesNeedingReminders(session.companyId)

    return NextResponse.json({
      count: invoices.length,
      invoices: invoices.map((item) => ({
        id: item.invoice.id,
        invoiceNumber: item.invoice.invoiceNumber,
        customerName: item.customer?.name || `${item.customer?.firstName} ${item.customer?.lastName}`,
        customerEmail: item.customer?.email,
        amount: item.invoice.total,
        dueDate: item.invoice.dueAt,
        status: item.invoice.status,
      })),
    })
  } catch (error: any) {
    console.error("Error fetching reminders preview:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch reminders" },
      { status: 500 }
    )
  }
}


