import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { generateInvoiceFromJob } from "@/lib/invoice-utils"

// POST /api/jobs/[id]/generate-invoice - Generate an invoice from a job
export async function POST(
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
    const { taxRate, discountAmount, notes, terms, footer, dueInDays } = body

    const invoice = await generateInvoiceFromJob({
      companyId,
      jobId: parseInt(id),
      taxRate: taxRate ? parseFloat(taxRate) : undefined,
      discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
      notes,
      terms,
      footer,
      dueInDays: dueInDays ? parseInt(dueInDays) : undefined,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    console.error("Error generating invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate invoice" },
      { status: 500 }
    )
  }
}

