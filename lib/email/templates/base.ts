/**
 * Base email template wrapper
 * Provides consistent layout structure for all emails
 */

import { colors, fonts, commonStyles, borderRadius } from '../styles'

export interface BaseTemplateOptions {
  /** Email title for <title> tag */
  title: string
  /** Use modern gradient header style */
  modernStyle?: boolean
  /** Company name for footer */
  companyName?: string
  /** Optional header content (icon, title, etc.) */
  headerContent?: string
  /** Main body content */
  bodyContent: string
  /** Optional footer content override */
  footerContent?: string
  /** Header title text */
  headerTitle?: string
  /** Header icon (emoji or HTML) */
  headerIcon?: string
}

/**
 * Wraps email content in a consistent base template
 */
export function baseTemplate(options: BaseTemplateOptions): string {
  const {
    title,
    modernStyle = false,
    companyName = 'CleanManager',
    headerContent,
    bodyContent,
    footerContent,
    headerTitle,
    headerIcon,
  } = options

  const currentYear = new Date().getFullYear()

  // Build header section
  let header = ''
  if (headerContent) {
    header = headerContent
  } else if (headerTitle) {
    if (modernStyle) {
      header = `
        <tr>
          <td style="${commonStyles.headerGradient}">
            ${headerIcon ? `<div style="margin-bottom: 15px; font-size: 40px;">${headerIcon}</div>` : ''}
            <h1 style="${commonStyles.heading1White}">${headerTitle}</h1>
          </td>
        </tr>`
    } else {
      header = `
        <tr>
          <td style="${commonStyles.headerCell}">
            ${headerIcon ? `<div style="margin-bottom: 20px; font-size: 32px;">${headerIcon}</div>` : ''}
            <h1 style="${commonStyles.heading1}">${headerTitle}</h1>
          </td>
        </tr>`
    }
  }

  // Build footer section
  const footer = footerContent || `
    <tr>
      <td style="${commonStyles.footerCell}">
        <p style="${commonStyles.footerText}">
          &copy; ${currentYear} ${escapeHtml(companyName)}. All rights reserved.
        </p>
      </td>
    </tr>`

  const contentTableStyle = modernStyle 
    ? commonStyles.contentTableModern 
    : commonStyles.contentTable

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="${commonStyles.body}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${commonStyles.outerTable}">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="${contentTableStyle}">
          ${header}
          
          <!-- Body -->
          <tr>
            <td style="${commonStyles.bodyCell}">
              ${bodyContent}
            </td>
          </tr>
          
          <!-- Footer -->
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Simple email template without header section
 */
export function simpleTemplate(options: {
  title: string
  bodyContent: string
  companyName?: string
}): string {
  return baseTemplate({
    ...options,
    headerTitle: undefined,
  })
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Format a URL safely for use in href attributes
 */
export function safeUrl(url?: string): string {
  if (!url || typeof url !== 'string') {
    return '#'
  }

  // Basic URL sanitization - ensure it starts with http/https
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://${url}`
}
