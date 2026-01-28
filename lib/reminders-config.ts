export interface ReminderConfig {
  enabled: boolean
  daysBeforeDue: number[]
  daysAfterDue: number[]
  emailTemplate: {
    subject: string
    body: string
  }
}

export const defaultReminderConfig: ReminderConfig = {
  enabled: true,
  daysBeforeDue: [7, 3, 1],
  daysAfterDue: [1, 7, 14, 30],
  emailTemplate: {
    subject: "Payment Reminder: Invoice {invoiceNumber}",
    body: `Dear {customerName},

This is a friendly reminder about invoice {invoiceNumber} for {amount}.

Invoice Details:
- Invoice Number: {invoiceNumber}
- Amount: {amount}
- Due Date: {dueDate}
- Status: {status}

{paymentInstructions}

If you have already made this payment, please disregard this message.

Thank you for your business!

Best regards,
{companyName}`,
  },
}
