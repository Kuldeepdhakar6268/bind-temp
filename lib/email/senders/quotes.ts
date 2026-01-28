/**
 * Quote-related email senders
 */

import { sendEmail } from '../transporter'
import { baseTemplate, escapeHtml } from '../templates/base'
import { 
  primaryButton, 
  linkText, 
  greeting, 
  paragraph, 
  mutedText, 
  infoBox, 
  detailsTable,
  itemsTable,
  totalsSummary,
  noteSection,
  alert,
} from '../templates/components'
import { formatDate, formatCurrency } from '../utils'
import { getCurrencySymbol, colors, commonStyles } from '../styles'
import type {
  QuoteEmailParams,
  QuoteAcceptedParams,
  QuoteRejectedParams,
  QuoteFollowUpParams,
} from '../types'

/**
 * Send quote email to customer
 */
export async function sendQuoteEmail(params: QuoteEmailParams) {
  const {
    customerEmail,
    customerName,
    quoteNumber,
    title,
    items,
    subtotal,
    taxRate,
    taxAmount,
    discountAmount,
    total,
    currency,
    validUntil,
    notes,
    terms,
    companyName,
    viewUrl,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const validUntilStr = validUntil ? formatDate(validUntil) : null

  // Build items table
  const itemsHtml = items.map(item => `
    <tr>
      <td style="${commonStyles.tableCell}">
        <strong>${escapeHtml(item.title)}</strong>
        ${item.description ? `<br><span style="color: ${colors.textMuted}; font-size: 13px;">${escapeHtml(item.description)}</span>` : ''}
      </td>
      <td style="${commonStyles.tableCell}" align="center">${item.quantity || '-'}</td>
      <td style="${commonStyles.tableCell}" align="right">${item.unitPrice ? `${currencySymbol}${item.unitPrice}` : '-'}</td>
      <td style="${commonStyles.tableCell}" align="right">${item.amount ? `${currencySymbol}${item.amount}` : '-'}</td>
    </tr>
  `).join('')

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Thank you for your interest! Please find your quote <strong>#${escapeHtml(quoteNumber)}</strong>${title ? ` for <strong>${escapeHtml(title)}</strong>` : ''} below.`)}
    
    <!-- Quote Items Table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="${commonStyles.tableHeader}" align="left">Description</th>
          <th style="${commonStyles.tableHeader}" align="center">Qty</th>
          <th style="${commonStyles.tableHeader}" align="right">Price</th>
          <th style="${commonStyles.tableHeader}" align="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <!-- Totals -->
    <div style="text-align: right; margin-top: 20px;">
      ${totalsSummary({
        subtotal,
        taxLabel: taxRate ? `VAT (${taxRate}%)` : null,
        taxAmount,
        discountAmount,
        total,
      }, currencySymbol)}
    </div>
    
    ${validUntilStr ? alert(`This quote is valid until ${validUntilStr}`, 'info') : ''}
    
    ${primaryButton('View Quote Online', viewUrl)}
    
    ${noteSection('Notes', notes)}
    ${noteSection('Terms & Conditions', terms)}
    
    ${mutedText(`If you have any questions about this quote, please don't hesitate to contact us.`)}
  `

  const html = baseTemplate({
    title: `Quote #${quoteNumber}`,
    headerTitle: `Quote #${quoteNumber}`,
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Quote #${quoteNumber} from ${companyName}`,
    html,
  })
}

/**
 * Send quote accepted notification to company
 */
export async function sendQuoteAcceptedNotification(params: QuoteAcceptedParams) {
  const {
    companyEmail,
    companyName,
    customerName,
    quoteNumber,
    quoteTitle,
    total,
    currency,
  } = params

  const currencySymbol = getCurrencySymbol(currency)

  const bodyContent = `
    ${paragraph('Great news! A quote has been accepted.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Quote Number', value: `#${quoteNumber}` },
        { label: 'Service', value: quoteTitle },
        { label: 'Customer', value: customerName },
        { label: 'Amount', value: `${currencySymbol}${total}` },
      ])}
    `, 'success')}
    ${mutedText('You can now proceed with scheduling and invoicing.')}
  `

  const html = baseTemplate({
    title: 'Quote Accepted',
    headerTitle: 'Quote Accepted!',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `Quote #${quoteNumber} Accepted by ${customerName}`,
    html,
  })
}

/**
 * Send quote rejected notification to company
 */
export async function sendQuoteRejectedNotification(params: QuoteRejectedParams) {
  const {
    companyEmail,
    companyName,
    customerName,
    quoteNumber,
    quoteTitle,
    reason,
  } = params

  const bodyContent = `
    ${paragraph('A quote has been declined by the customer.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Quote Number', value: `#${quoteNumber}` },
        { label: 'Service', value: quoteTitle },
        { label: 'Customer', value: customerName },
        { label: 'Reason', value: reason || 'Not specified' },
      ])}
    `, 'warning')}
    ${mutedText('Consider following up with the customer to understand their needs better.')}
  `

  const html = baseTemplate({
    title: 'Quote Declined',
    headerTitle: 'Quote Declined',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `Quote #${quoteNumber} Declined by ${customerName}`,
    html,
  })
}

/**
 * Send quote follow-up email to customer
 */
export async function sendQuoteFollowUp(params: QuoteFollowUpParams) {
  const {
    customerEmail,
    customerName,
    quoteNumber,
    title,
    total,
    currency,
    validUntil,
    companyName,
    viewUrl,
  } = params

  const currencySymbol = getCurrencySymbol(currency)
  const validUntilStr = validUntil ? formatDate(validUntil) : null

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`We wanted to follow up on the quote we sent you.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Quote Number', value: `#${quoteNumber}` },
        { label: 'Service', value: title },
        { label: 'Total', value: `${currencySymbol}${total}` },
        { label: 'Valid Until', value: validUntilStr },
      ])}
    `)}
    ${paragraph('If you have any questions or would like to discuss the quote, we would be happy to help.')}
    ${primaryButton('View Quote', viewUrl)}
    ${mutedText('Simply reply to this email if you need any changes or clarification.')}
  `

  const html = baseTemplate({
    title: 'Quote Follow-up',
    headerTitle: 'Just Checking In',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Following up on Quote #${quoteNumber} - ${companyName}`,
    html,
  })
}
