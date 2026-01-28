import { sendEmail } from "@/lib/email"

type SupplyItem = {
  name: string
  quantity: number
  category?: string
}

const formatItems = (items: SupplyItem[]) => {
  if (!items || items.length === 0) return "No items listed"
  return items
    .map((item) => `${item.name} x${item.quantity}${item.category ? ` (${item.category})` : ""}`)
    .join(", ")
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://moppissimo.space"

export async function sendSupplyRequestCreatedEmail(params: {
  to: string
  companyName: string
  employeeName: string
  items: SupplyItem[]
  urgency: string
  neededBy?: Date | null
  notes?: string | null
  requestId: number
}) {
  const neededBy = params.neededBy ? params.neededBy.toLocaleDateString("en-GB") : "Not specified"
  const itemsLine = formatItems(params.items)
  const requestUrl = `${baseUrl}/supply-requests`

  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; padding: 24px;">
            <tr>
              <td>
                <h2 style="margin: 0 0 12px;">New supply request</h2>
                <p style="margin: 0 0 16px;">${params.employeeName} submitted a supply request.</p>
                <p style="margin: 0 0 8px;"><strong>Items:</strong> ${itemsLine}</p>
                <p style="margin: 0 0 8px;"><strong>Urgency:</strong> ${params.urgency}</p>
                <p style="margin: 0 0 8px;"><strong>Needed by:</strong> ${neededBy}</p>
                ${params.notes ? `<p style="margin: 0 0 8px;"><strong>Notes:</strong> ${params.notes}</p>` : ""}
                <p style="margin: 16px 0 0;">
                  <a href="${requestUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
                    Review request
                  </a>
                </p>
              </td>
            </tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">${params.companyName}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`

  return sendEmail({
    to: params.to,
    subject: `New supply request from ${params.employeeName}`,
    html,
  })
}

export async function sendSupplyRequestStatusEmail(params: {
  to: string
  companyName: string
  employeeName: string
  items: SupplyItem[]
  status: "approved" | "denied" | "fulfilled"
  reviewNotes?: string | null
  requestId: number
}) {
  const statusLabel = params.status.charAt(0).toUpperCase() + params.status.slice(1)
  const itemsLine = formatItems(params.items)
  const requestUrl = `${baseUrl}/employee/supply-requests`

  const html = `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; padding: 24px;">
            <tr>
              <td>
                <h2 style="margin: 0 0 12px;">Supply request ${statusLabel}</h2>
                <p style="margin: 0 0 16px;">Hi ${params.employeeName}, your supply request has been ${params.status}.</p>
                <p style="margin: 0 0 8px;"><strong>Items:</strong> ${itemsLine}</p>
                ${params.reviewNotes ? `<p style="margin: 0 0 8px;"><strong>Notes:</strong> ${params.reviewNotes}</p>` : ""}
                <p style="margin: 16px 0 0;">
                  <a href="${requestUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;">
                    View request
                  </a>
                </p>
              </td>
            </tr>
          </table>
          <p style="color: #6b7280; font-size: 12px; margin-top: 12px;">${params.companyName}</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`

  return sendEmail({
    to: params.to,
    subject: `Supply request ${statusLabel}`,
    html,
  })
}
