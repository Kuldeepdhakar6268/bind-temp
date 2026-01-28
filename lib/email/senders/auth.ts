/**
 * Authentication-related email senders
 * - Email verification
 * - Password reset
 * - Welcome email
 * - Employee credentials
 * - Customer portal login
 */

import { sendEmail } from '../transporter'
import { baseTemplate } from '../templates/base'
import { primaryButton, linkText, greeting, paragraph, mutedText, infoBox, detailsTable } from '../templates/components'
import { escapeHtml } from '../templates/base'
import { formatDate, buildAppUrl } from '../utils'
import type {
  VerificationEmailParams,
  PasswordResetEmailParams,
  WelcomeEmailParams,
  EmployeeCredentialsEmailParams,
  CustomerPortalLoginParams,
} from '../types'

/**
 * Send email verification email
 */
export async function sendVerificationEmail({
  email,
  verificationToken,
  userName,
}: VerificationEmailParams) {
  const verifyUrl = buildAppUrl(`/verify-email?token=${verificationToken}`)

  const bodyContent = `
    ${greeting(userName)}
    ${paragraph('Thank you for signing up for CleanManager! Please verify your email address by clicking the button below:')}
    ${primaryButton('Verify Email Address', verifyUrl)}
    ${linkText('Or copy and paste this link into your browser:', verifyUrl)}
    ${mutedText('This link will expire in 24 hours for security reasons.')}
    ${mutedText("If you didn't create an account with CleanManager, you can safely ignore this email.")}
  `

  const html = baseTemplate({
    title: 'Verify Your Email',
    headerTitle: 'Verify Your Email',
    bodyContent,
  })

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - CleanManager',
    html,
  })
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({
  email,
  resetToken,
  userName,
}: PasswordResetEmailParams) {
  const resetUrl = buildAppUrl(`/reset-password?token=${resetToken}`)

  const bodyContent = `
    ${greeting(userName)}
    ${paragraph('We received a request to reset your password for your CleanManager account. Click the button below to create a new password:')}
    ${primaryButton('Reset Password', resetUrl)}
    ${linkText('Or copy and paste this link into your browser:', resetUrl)}
    ${mutedText('This link will expire in 1 hour for security reasons.')}
    ${mutedText("If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.")}
  `

  const html = baseTemplate({
    title: 'Reset Your Password',
    headerTitle: 'Reset Your Password',
    bodyContent,
  })

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - CleanManager',
    html,
  })
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail({
  email,
  userName,
  companyName,
}: WelcomeEmailParams) {
  const loginUrl = buildAppUrl('/login')

  const bodyContent = `
    ${greeting(userName)}
    ${paragraph(`Welcome to CleanManager! Your account for <strong>${escapeHtml(companyName)}</strong> has been successfully created.`)}
    ${paragraph("You're now ready to start managing your cleaning business more efficiently. Here's what you can do:")}
    ${infoBox(`
      <ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
        <li style="margin-bottom: 10px;">Manage jobs and schedules</li>
        <li style="margin-bottom: 10px;">Track employees and assignments</li>
        <li style="margin-bottom: 10px;">Send invoices and track payments</li>
        <li style="margin-bottom: 10px;">View reports and analytics</li>
        <li style="margin-bottom: 10px;">Mobile-friendly interface</li>
      </ul>
    `)}
    ${primaryButton('Go to Dashboard', loginUrl)}
    ${mutedText('If you have any questions, feel free to reach out to our support team.')}
  `

  const html = baseTemplate({
    title: 'Welcome to CleanManager',
    headerTitle: 'Welcome to CleanManager!',
    bodyContent,
    companyName: 'CleanManager',
  })

  return sendEmail({
    to: email,
    subject: `Welcome to CleanManager, ${userName}!`,
    html,
  })
}

/**
 * Send employee credentials email
 */
export async function sendEmployeeCredentialsEmail({
  email,
  name,
  password,
  companyName,
  loginUrl = buildAppUrl('/login'),
}: EmployeeCredentialsEmailParams) {
  const bodyContent = `
    ${greeting(name)}
    ${paragraph(`You have been added as an employee at <strong>${escapeHtml(companyName)}</strong>. Your account has been created and is ready to use.`)}
    ${infoBox(`
      <p style="margin: 0 0 10px; font-weight: 600; color: #333;">Your Login Credentials:</p>
      ${detailsTable([
        { label: 'Email', value: email },
        { label: 'Temporary Password', value: password },
      ])}
    `, 'success')}
    ${primaryButton('Login to Your Account', loginUrl, 'success')}
    ${paragraph('<strong>Important:</strong> Please change your password after your first login for security purposes.', true)}
    ${mutedText('If you have any questions, please contact your manager or administrator.')}
  `

  const html = baseTemplate({
    title: 'Your Employee Account',
    headerTitle: 'Welcome to the Team!',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: email,
    subject: `Your Employee Account at ${companyName}`,
    html,
  })
}

/**
 * Send customer portal login code
 */
export async function sendCustomerPortalLoginCode({
  email,
  customerName,
  loginCode,
  companyName,
  expiresInMinutes = 15,
}: CustomerPortalLoginParams) {
  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`You requested access to your customer portal at <strong>${escapeHtml(companyName)}</strong>.`)}
    ${paragraph('Use the following code to log in:')}
    ${infoBox(`
      <div style="text-align: center;">
        <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Your login code:</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${escapeHtml(loginCode)}</p>
      </div>
    `)}
    ${mutedText(`This code will expire in ${expiresInMinutes} minutes.`)}
    ${mutedText("If you didn't request this code, you can safely ignore this email.")}
  `

  const html = baseTemplate({
    title: 'Your Login Code',
    headerTitle: 'Customer Portal Login',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: email,
    subject: `Your Login Code - ${companyName}`,
    html,
  })
}
