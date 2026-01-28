/**
 * Email transporter with lazy initialization and retry logic
 */

import * as nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { SendEmailParams, EmailResult, EmailConfig, RetryConfig } from './types'
import { stripHtml, validateEmail, sleep } from './utils'

// Configuration from environment
const config: EmailConfig = {
  host: process.env.MAIL_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.MAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USERNAME || '',
    pass: process.env.MAIL_PASSWORD || '',
  },
  fromEmail: process.env.MAIL_FROM_ADDRESS || 'cleaning@bindme.co.uk',
  fromName: process.env.MAIL_FROM_NAME || 'BindMe',
}

// Default retry configuration
const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
}

// Lazy-initialized transporter
let _transporter: Transporter | null = null

/**
 * Get or create the email transporter (lazy initialization)
 */
function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
    })
  }
  return _transporter
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return Boolean(config.auth.user && config.auth.pass)
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection(): Promise<boolean> {
  if (!isEmailConfigured()) {
    return false
  }
  try {
    await getTransporter().verify()
    return true
  } catch {
    return false
  }
}

/**
 * Calculate delay for retry with exponential backoff
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    // Retry on connection/network errors
    if (
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket') ||
      message.includes('network') ||
      message.includes('temporary') ||
      message.includes('try again')
    ) {
      return true
    }
    // Check for SMTP response codes that are retryable
    const code = (error as { responseCode?: number }).responseCode
    if (code && code >= 400 && code < 500 && code !== 421) {
      // 4xx errors except 421 (service not available, try again)
      return false
    }
    if (code === 421 || (code && code >= 500)) {
      return true
    }
  }
  return false
}

/**
 * Send an email with retry logic
 */
function normalizeRecipients(to: string | string[]): string[] {
  const recipients = Array.isArray(to) ? to : [to]
  return recipients.map((addr) => addr.trim()).filter((addr) => addr.length > 0)
}

export async function sendEmail(
  params: SendEmailParams,
  retryConfig: RetryConfig = defaultRetryConfig
): Promise<EmailResult> {
  const { to, subject, html, text, attachments } = params
  const recipientList = normalizeRecipients(to)

  if (recipientList.length === 0) {
    throw new Error('No email recipients provided')
  }

  recipientList.forEach((recipient) => {
    if (!validateEmail(recipient)) {
      throw new Error(`Invalid email address: ${recipient}`)
    }
  })

  // Development mode - log email instead of sending
  if (!isEmailConfigured()) {
    console.error('MAIL_USERNAME or MAIL_PASSWORD is not set. Email not sent.')

    if (process.env.NODE_ENV === 'development') {
      logDevelopmentEmail(recipientList.join(', '), subject, html)
      return { success: true, id: 'dev-mode' }
    }

    throw new Error('Email service not configured')
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryConfig)
        console.log(`Retrying email send (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}) after ${delay}ms`)
        await sleep(delay)
      }

      const transporter = getTransporter()
      const info = await transporter.sendMail({
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: recipientList.join(', '),
        subject,
        html,
        text: text || stripHtml(html),
        attachments,
      })

      console.log('Email sent:', info.messageId)
      return { success: true, id: info.messageId }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.error(`Email send attempt ${attempt + 1} failed:`, lastError.message)

      if (!isRetryableError(error)) {
        break
      }
    }
  }

  console.error('All email send attempts failed:', lastError)
  throw lastError || new Error('Failed to send email')
}

/**
 * Log email in development mode
 */
function logDevelopmentEmail(to: string, subject: string, html: string): void {
  console.log('\n' + '='.repeat(80))
  console.log(' EMAIL (DEVELOPMENT MODE - NOT ACTUALLY SENT)')
  console.log('='.repeat(80))
  console.log('To:', to)
  console.log('Subject:', subject)
  console.log('='.repeat(80) + '\n')

  // Extract verification or reset link from HTML
  const verifyLinkMatch = html.match(/href="([^"]*verify-email[^"]*)"/i)
  const resetLinkMatch = html.match(/href="([^"]*reset-password[^"]*)"/i)
  const portalLinkMatch = html.match(/href="([^"]*portal[^"]*)"/i)

  if (verifyLinkMatch) {
    console.log('EMAIL VERIFICATION LINK:')
    console.log(verifyLinkMatch[1])
    console.log('='.repeat(80) + '\n')
  }
  if (resetLinkMatch) {
    console.log('PASSWORD RESET LINK:')
    console.log(resetLinkMatch[1])
    console.log('='.repeat(80) + '\n')
  }
  if (portalLinkMatch) {
    console.log('PORTAL LINK:')
    console.log(portalLinkMatch[1])
    console.log('='.repeat(80) + '\n')
  }
}

/**
 * Close the transporter connection pool
 */
export async function closeTransporter(): Promise<void> {
  if (_transporter) {
    _transporter.close()
    _transporter = null
  }
}

/**
 * Get email configuration (for debugging, redacts password)
 */
export function getEmailConfig(): Omit<EmailConfig, 'auth'> & { auth: { user: string; pass: string } } {
  return {
    ...config,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass ? '***REDACTED***' : '',
    },
  }
}
