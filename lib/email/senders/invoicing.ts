/**
 * Invoice and payment-related email senders
 */

import { sendEmail } from '../transporter'
import { baseTemplate, escapeHtml } from '../templates/base'
import { 
  primaryButton, 
  greeting, 
  paragraph, 
  mutedText, 
  infoBox, 
  detailsTable,
  itemsTable,
  totalsSummary,
  alert,
  badge,
} from '../templates/components'
import { formatDate, formatDateTime, formatCurrency } from '../utils'
import { getCurrencySymbol, colors, commonStyles } from '../styles'
import type {
  InvoiceEmailParams,
  InvoiceWithPDFEmailParams,
  PaymentRequestEmailParams,
  PaymentReminderEmailParams,
  PaymentReceiptEmailParams,
} from '../types'

/**
 * Send invoice email to customer
 */
export async function sendInvoiceEmail(params: InvoiceEmailParams) {
  const {
    customerEmail,
    customerName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    companyName,
    viewUrl,
    items,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const dueDateStr = formatDate(dueDate)

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Please find your invoice <strong>#${escapeHtml(invoiceNumber)}</strong> attached below.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Invoice Number', value: `#${invoiceNumber}` },
        { label: 'Amount Due', value: `${currencySymbol}${amount}` },
        { label: 'Due Date', value: dueDateStr },
      ])}
    `)}
    ${items && items.length > 0 ? `
      <h3 style="margin: 30px 0 15px; color: ${colors.textDark}; font-size: 16px;">Invoice Items</h3>
      ${itemsTable(items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })), currencySymbol)}
    ` : ''}
    ${primaryButton('View & Pay Invoice', viewUrl, 'success')}
    ${mutedText('Thank you for your business. Please ensure payment is made by the due date.')}
  `

  const html = baseTemplate({
    title: `Invoice #${invoiceNumber}`,
    headerTitle: `Invoice #${invoiceNumber}`,
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Invoice #${invoiceNumber} from ${companyName}`,
    html,
  })
}

/**
 * Send invoice email with PDF attachment
 */
export async function sendInvoiceWithPDFEmail(params: InvoiceWithPDFEmailParams) {
  const {
    customerEmail,
    customerName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    companyName,
    viewUrl,
    pdfBuffer,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const dueDateStr = formatDate(dueDate)

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Please find your invoice <strong>#${escapeHtml(invoiceNumber)}</strong> attached to this email.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Invoice Number', value: `#${invoiceNumber}` },
        { label: 'Amount Due', value: `${currencySymbol}${amount}` },
        { label: 'Due Date', value: dueDateStr },
      ])}
    `)}
    ${primaryButton('View Invoice Online', viewUrl)}
    ${mutedText('A PDF copy of your invoice is attached to this email.')}
    ${mutedText('Thank you for your business!')}
  `

  const html = baseTemplate({
    title: `Invoice #${invoiceNumber}`,
    headerTitle: `Invoice #${invoiceNumber}`,
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Invoice #${invoiceNumber} from ${companyName}`,
    html,
    attachments: [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}

/**
 * Send payment request email
 */
export async function sendPaymentRequestEmail(params: PaymentRequestEmailParams) {
  const {
    customerEmail,
    customerName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    companyName,
    paymentUrl,
    description,
    pdfBuffer,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const dueDateStr = formatDate(dueDate)

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`A payment is due for your recent service.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Invoice', value: `#${invoiceNumber}` },
        { label: 'Description', value: description },
        { label: 'Amount', value: `${currencySymbol}${amount}` },
        { label: 'Due Date', value: dueDateStr },
      ])}
    `)}
    ${primaryButton('Pay Now', paymentUrl, 'success')}
    ${mutedText('You can pay securely online using the button above.')}
    ${mutedText('A PDF copy of your invoice is attached to this email.')}
  `

  const html = baseTemplate({
    title: 'Payment Request',
    headerTitle: 'Payment Request',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Payment Request: Invoice #${invoiceNumber} - ${companyName}`,
    html,
    attachments: pdfBuffer ? [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ] : undefined,
  })
}

/**
 * Send payment reminder email
 */
export async function sendPaymentReminderEmail(params: PaymentReminderEmailParams) {
  const {
    customerEmail,
    customerName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    daysOverdue,
    companyName,
    paymentUrl,
    pdfBuffer,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const dueDateStr = formatDate(dueDate)

  const urgencyLevel = daysOverdue > 30 ? 'error' : daysOverdue > 14 ? 'warning' : 'info'
  const urgencyMessage = daysOverdue > 30 
    ? 'This payment is significantly overdue. Please pay immediately to avoid further action.'
    : daysOverdue > 14
    ? 'This payment is now overdue. Please make payment as soon as possible.'
    : 'This is a friendly reminder that your payment is due.'

  const bodyContent = `
    ${greeting(customerName)}
    ${alert(urgencyMessage, urgencyLevel)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Invoice', value: `#${invoiceNumber}` },
        { label: 'Amount Due', value: `${currencySymbol}${amount}` },
        { label: 'Due Date', value: dueDateStr },
        { label: 'Days Overdue', value: daysOverdue > 0 ? `${daysOverdue} days` : null },
      ])}
    `, urgencyLevel === 'error' ? 'error' : urgencyLevel === 'warning' ? 'warning' : 'default')}
    ${primaryButton('Pay Now', paymentUrl, 'success')}
    ${mutedText('If you have already made this payment, please disregard this reminder.')}
    ${mutedText('If you have any questions about this invoice, please contact us.')}
  `

  const html = baseTemplate({
    title: 'Payment Reminder',
    headerTitle: daysOverdue > 14 ? '⚠️ Payment Overdue' : 'Payment Reminder',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: daysOverdue > 14 
      ? `OVERDUE: Invoice #${invoiceNumber} - ${companyName}`
      : `Payment Reminder: Invoice #${invoiceNumber} - ${companyName}`,
    html,
    attachments: pdfBuffer ? [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ] : undefined,
  })
}

/**
 * Send payment receipt email
 */
export async function sendPaymentReceiptEmail(params: PaymentReceiptEmailParams) {
  const {
    customerEmail,
    customerName,
    invoiceNumber,
    amount,
    currency,
    paidAt,
    paymentMethod,
    companyName,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const paidAtStr = formatDateTime(paidAt)

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph('Thank you for your payment! This email confirms we have received your payment.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Invoice', value: `#${invoiceNumber}` },
        { label: 'Amount Paid', value: `${currencySymbol}${amount}` },
        { label: 'Payment Date', value: paidAtStr },
        { label: 'Payment Method', value: paymentMethod },
      ])}
    `, 'success')}
    ${paragraph(`${badge('PAID', 'success')}`, true)}
    ${mutedText('Thank you for your business. Please keep this email for your records.')}
  `

  const html = baseTemplate({
    title: 'Payment Receipt',
    headerTitle: 'Payment Received',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Payment Receipt: Invoice #${invoiceNumber} - ${companyName}`,
    html,
  })
}
