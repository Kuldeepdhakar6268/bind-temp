/**
 * Reusable email template components
 */

import { colors, commonStyles, borderRadius, fontSize, fontWeight, spacing } from '../styles'
import { escapeHtml, safeUrl } from './base'

/**
 * Primary CTA button
 */
export function primaryButton(text: string, url: string, style: 'primary' | 'gradient' | 'success' = 'primary'): string {
  const buttonStyles = {
    primary: commonStyles.buttonPrimary,
    gradient: commonStyles.buttonGradient,
    success: commonStyles.buttonSuccess,
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <a href="${safeUrl(url)}" style="${buttonStyles[style]}">
            ${escapeHtml(text)}
          </a>
        </td>
      </tr>
    </table>`
}

/**
 * Secondary link text
 */
export function linkText(label: string, url: string): string {
  return `
    <p style="${commonStyles.paragraphSmall}">
      ${escapeHtml(label)}
    </p>
    <p style="${commonStyles.linkUrl}">
      ${safeUrl(url)}
    </p>`
}

/**
 * Information box with background
 */
export function infoBox(content: string, variant: 'default' | 'success' | 'warning' | 'error' = 'default'): string {
  const bgColors = {
    default: colors.bgLighter,
    success: colors.successBg,
    warning: colors.warningBg,
    error: colors.errorBg,
  }

  return `
    <div style="background-color: ${bgColors[variant]}; border-radius: ${borderRadius.lg}; padding: 20px; margin: 20px 0;">
      ${content}
    </div>`
}

/**
 * Detail row (label: value)
 */
export function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return ''
  return `
    <tr>
      <td style="${commonStyles.detailRow}">${escapeHtml(label)}:</td>
      <td style="${commonStyles.detailValue}">${escapeHtml(value)}</td>
    </tr>`
}

/**
 * Details table
 */
export function detailsTable(rows: Array<{ label: string; value: string | null | undefined }>): string {
  const validRows = rows.filter(r => r.value)
  if (validRows.length === 0) return ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      ${validRows.map(r => detailRow(r.label, r.value)).join('')}
    </table>`
}

/**
 * Status badge
 */
export function badge(text: string, variant: 'success' | 'warning' | 'error' | 'info' = 'info'): string {
  const styles = {
    success: commonStyles.successBadge,
    warning: commonStyles.warningBadge,
    error: commonStyles.errorBadge,
    info: `display: inline-block; padding: 4px 12px; background-color: ${colors.infoBg}; color: ${colors.info}; border-radius: 20px; font-size: ${fontSize.sm}; font-weight: ${fontWeight.medium};`,
  }

  return `<span style="${styles[variant]}">${escapeHtml(text)}</span>`
}

/**
 * Divider line
 */
export function divider(): string {
  return `<hr style="border: none; border-top: 1px solid ${colors.border}; margin: 30px 0;">`
}

/**
 * Greeting paragraph
 */
export function greeting(name: string): string {
  return `<p style="${commonStyles.paragraph}">Hi ${escapeHtml(name)},</p>`
}

/**
 * Standard paragraph
 */
export function paragraph(text: string, muted = false): string {
  const style = muted ? commonStyles.paragraphMuted : commonStyles.paragraph
  return `<p style="${style}">${text}</p>`
}

/**
 * Small muted text
 */
export function mutedText(text: string): string {
  return `<p style="${commonStyles.paragraphMuted}">${escapeHtml(text)}</p>`
}

/**
 * Items/line items table
 */
export function itemsTable(
  items: Array<{ description: string; quantity?: string | number | null; unitPrice?: string | null; amount: string | null }>,
  currencySymbol = '£'
): string {
  return `
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
        ${items.map(item => `
          <tr>
            <td style="${commonStyles.tableCell}">${escapeHtml(item.description)}</td>
            <td style="${commonStyles.tableCell}" align="center">${item.quantity || '-'}</td>
            <td style="${commonStyles.tableCell}" align="right">${item.unitPrice ? `${currencySymbol}${item.unitPrice}` : '-'}</td>
            <td style="${commonStyles.tableCell}" align="right">${item.amount ? `${currencySymbol}${item.amount}` : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`
}

/**
 * Total row for invoices/quotes
 */
export function totalRow(label: string, amount: string, currencySymbol = '£', isTotal = false): string {
  const textStyle = isTotal 
    ? `font-size: ${fontSize.lg}; font-weight: ${fontWeight.bold}; color: ${colors.textDark};`
    : `font-size: ${fontSize.sm}; color: ${colors.textSecondary};`

  return `
    <tr>
      <td style="padding: 8px 0; ${textStyle}" align="right">${escapeHtml(label)}:</td>
      <td style="padding: 8px 0 8px 16px; ${textStyle}" align="right">${currencySymbol}${escapeHtml(amount)}</td>
    </tr>`
}

/**
 * Totals summary section
 */
export function totalsSummary(
  totals: {
    subtotal?: string | null
    taxLabel?: string | null
    taxAmount?: string | null
    discountAmount?: string | null
    total: string | null
  },
  currencySymbol = '£'
): string {
  const rows: string[] = []

  if (totals.subtotal) {
    rows.push(totalRow('Subtotal', totals.subtotal, currencySymbol))
  }
  if (totals.discountAmount) {
    rows.push(totalRow('Discount', `-${totals.discountAmount}`, currencySymbol))
  }
  if (totals.taxAmount && totals.taxLabel) {
    rows.push(totalRow(totals.taxLabel, totals.taxAmount, currencySymbol))
  }
  if (totals.total) {
    rows.push(totalRow('Total', totals.total, currencySymbol, true))
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>`
}

/**
 * Note or terms section
 */
export function noteSection(title: string, content: string | null | undefined): string {
  if (!content) return ''
  return `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${colors.border};">
      <h3 style="margin: 0 0 10px; color: ${colors.textMuted}; font-size: ${fontSize.sm}; font-weight: ${fontWeight.semibold}; text-transform: uppercase; letter-spacing: 0.5px;">
        ${escapeHtml(title)}
      </h3>
      <p style="${commonStyles.paragraphSmall}">${escapeHtml(content)}</p>
    </div>`
}

/**
 * Alert/callout box
 */
export function alert(message: string, variant: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
  const configs = {
    info: { bg: colors.infoBg, border: colors.info, icon: '&#9432;' },
    success: { bg: colors.successBg, border: colors.success, icon: '&#10003;' },
    warning: { bg: colors.warningBg, border: colors.warning, icon: '&#9888;' },
    error: { bg: colors.errorBg, border: colors.error, icon: '&#10005;' },
  }
  const config = configs[variant]

  return `
    <div style="background-color: ${config.bg}; border-left: 4px solid ${config.border}; padding: 16px; margin: 20px 0; border-radius: 0 ${borderRadius.md} ${borderRadius.md} 0;">
      <p style="margin: 0; color: ${colors.textPrimary}; font-size: ${fontSize.sm};">
        ${config.icon} ${escapeHtml(message)}
      </p>
    </div>`
}
