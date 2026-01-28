import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { getSession } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { generateContractPDF } from "@/lib/pdf-generator"

// POST /api/contracts/[id]/send - Send contract notification email to customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contractId = parseInt(id)
    const body = await request.json()
    const { type = "update" } = body // type: 'new', 'update', 'renewal', 'cancelled'

    const contract = await db.query.contracts.findFirst({
      where: and(
        eq(schema.contracts.id, contractId),
        eq(schema.contracts.companyId, session.companyId)
      ),
      with: {
        customer: true,
      },
    })

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 })
    }

    const customer = contract.customer as any
    if (!customer?.email) {
      return NextResponse.json({ error: "Customer email not found" }, { status: 400 })
    }

    // Get company info
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Customer"
    const companyName = company?.name || "Your Service Provider"
    const currencySymbol = "£"

    let subject = ""
    let messageTitle = ""
    let messageBody = ""

    switch (type) {
      case "new":
        subject = `New Contract: ${contract.title} - ${companyName}`
        messageTitle = "New Contract Created"
        messageBody = `A new service contract has been created for you.`
        break
      case "renewal":
        subject = `Contract Renewal: ${contract.title} - ${companyName}`
        messageTitle = "Contract Renewed"
        messageBody = `Your service contract has been renewed.`
        break
      case "cancelled":
        subject = `Contract Cancelled: ${contract.title} - ${companyName}`
        messageTitle = "Contract Cancelled"
        messageBody = `Your service contract has been cancelled.`
        break
      default:
        subject = `Contract Updated: ${contract.title} - ${companyName}`
        messageTitle = "Contract Updated"
        messageBody = `Your service contract has been updated.`
    }

    const formatDate = (date: Date | null) => {
      if (!date) return "N/A"
      return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    }

    const pdfDoc = generateContractPDF({
      contractNumber: contract.contractNumber,
      title: contract.title,
      description: contract.description,
      frequency: contract.frequency,
      amount: contract.amount,
      billingFrequency: contract.billingFrequency,
      startDate: contract.startDate ? contract.startDate.toISOString() : null,
      endDate: contract.endDate ? contract.endDate.toISOString() : null,
      autoRenew: contract.autoRenew === 1,
      status: contract.status,
      terms: contract.terms,
      notes: contract.notes,
      company: {
        name: companyName,
      },
      customer: {
        name: customerName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        postcode: customer.postcode,
      },
    })
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"))
    const pdfFilename = `contract-${contract.contractNumber}.pdf`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 24px;">${messageTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px;">Hi ${customerName},</p>
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px;">${messageBody}</p>
              
              <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; color: #1a1a1a; font-size: 18px;">Contract Details</h3>
                <table width="100%" style="font-size: 14px; color: #4a4a4a;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><strong>Contract Number:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${contract.contractNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><strong>Service:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${contract.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><strong>Frequency:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${contract.frequency || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><strong>Amount:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${currencySymbol}${parseFloat(contract.amount || '0').toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;"><strong>Start Date:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatDate(contract.startDate)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>End Date:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${contract.endDate ? formatDate(contract.endDate) : 'Rolling'}</td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 20px 0 0; color: #6b6b6b; font-size: 14px;">
                If you have any questions about your contract, please don't hesitate to contact us.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 30px; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #6b6b6b; font-size: 14px;">
                ${companyName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

    let emailSent = false
    let emailError = null

    try {
      await sendEmail({
        to: customer.email,
        subject,
        html,
        attachments: [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      })
      emailSent = true
    } catch (err) {
      console.error("Email sending failed:", err)
      emailError = err instanceof Error ? err.message : "Email service error"
    }

    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: `Contract notification sent to ${customer.email}`,
      })
    } else {
      return NextResponse.json({
        success: false,
        warning: `Email delivery failed: ${emailError}`,
      })
    }
  } catch (error) {
    console.error("Error sending contract notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
