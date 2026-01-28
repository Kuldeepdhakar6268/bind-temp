/**
 * Admin email senders - for system admin notifications
 */

import { sendEmail } from '../transporter'
import { baseTemplate, escapeHtml } from '../templates/base'
import { 
  primaryButton, 
  greeting, 
  paragraph, 
  divider,
  infoBox,
} from '../templates/components'
import { colors, spacing, fontSize, borderRadius, fontWeight } from '../styles'
import { buildAppUrl } from '../utils'
import type { EmailResult } from '../types'

interface WelcomeCompanyEmailData {
  companyName: string
  companyEmail: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  password: string
  loginUrl?: string
  features: Array<{
    name: string
    price: number
    type: 'company' | 'employee'
  }>
  maxEmployees: number
  employeeRate: number
  monthlyPlanCost: number
}

interface FeatureUpdateEmailData {
  companyName: string
  companyEmail: string
  adminFirstName: string
  addedFeatures?: Array<{ name: string; price: number; type: 'company' | 'employee' }>
  removedFeatures?: Array<{ name: string; price: number; type: 'company' | 'employee' }>
  maxEmployees: number
  employeeRate: number
  oldMonthlyCost: number
  newMonthlyCost: number
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}

function featureListItem(name: string, price: number, type: string, icon: string = '✓'): string {
  const priceText = price === 0 ? 'Free' : formatPrice(price)
  const perText = type === 'employee' ? '/emp/mo' : '/month'
  return `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="color: ${colors.success}; margin-right: 8px;">${icon}</span>
        ${escapeHtml(name)}
      </td>
      <td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #f0f0f0; color: ${price === 0 ? colors.success : colors.textDark};">
        ${priceText}${price > 0 ? ` <small style="color: ${colors.textMuted};">${perText}</small>` : ''}
      </td>
    </tr>`
}

/**
 * Send welcome email to new company admin with credentials and plan details
 */
export async function sendWelcomeCompanyEmail(data: WelcomeCompanyEmailData): Promise<EmailResult> {
  const {
    companyName,
    adminFirstName,
    adminLastName,
    adminEmail,
    password,
    loginUrl = buildAppUrl('/login'),
    features,
    maxEmployees,
    employeeRate,
    monthlyPlanCost,
  } = data

  const companyFeatures = features.filter(f => f.type === 'company')
  const employeeFeatures = features.filter(f => f.type === 'employee')

  const companyFeaturesCost = companyFeatures.reduce((sum, f) => sum + f.price, 0)
  const employeeFeaturesCost = employeeFeatures.reduce((sum, f) => sum + f.price, 0)
  const perEmployeeCost = employeeFeaturesCost + employeeRate

  // Build features tables
  const companyFeaturesHtml = companyFeatures.length > 0 
    ? `
      <h3 style="color: ${colors.primary}; margin: 20px 0 10px; font-size: ${fontSize.md};">Company Features</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${companyFeatures.map(f => featureListItem(f.name, f.price, f.type)).join('')}
      </table>`
    : ''

  const employeeFeaturesHtml = employeeFeatures.length > 0
    ? `
      <h3 style="color: ${colors.primary}; margin: 20px 0 10px; font-size: ${fontSize.md};">Employee Features (per employee)</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${employeeFeatures.map(f => featureListItem(f.name, f.price, f.type)).join('')}
      </table>`
    : ''

  const bodyContent = `
    ${greeting(`Welcome, ${adminFirstName}!`)}
    
    ${paragraph(`Your company <strong>${escapeHtml(companyName)}</strong> has been set up on our platform. You can now start managing your cleaning business.`)}
    
    ${infoBox(`
      <h3 style="margin: 0 0 15px; color: ${colors.textDark};">🔐 Your Login Credentials</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; font-weight: ${fontWeight.medium};">Email:</td>
          <td style="padding: 8px 0;">${escapeHtml(adminEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: ${fontWeight.medium};">Password:</td>
          <td style="padding: 8px 0;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${escapeHtml(password)}</code></td>
        </tr>
      </table>
      <p style="margin: 15px 0 0; font-size: ${fontSize.sm}; color: ${colors.textMuted};">
        Please change your password after your first login.
      </p>
    `, 'default')}

    ${primaryButton('Log In to Your Account', loginUrl, 'primary')}

    ${divider()}

    <h2 style="color: ${colors.textDark}; margin: 30px 0 20px; font-size: ${fontSize.lg};">📋 Your Plan Details</h2>

    ${companyFeaturesHtml}
    ${employeeFeaturesHtml}

    ${divider()}

    <div style="background: linear-gradient(135deg, ${colors.primary}10 0%, ${colors.primary}05 100%); border-radius: ${borderRadius.lg}; padding: 20px; margin: 20px 0; border: 2px solid ${colors.primary};">
      <h3 style="margin: 0 0 15px; color: ${colors.primary};">💰 Monthly Cost Breakdown</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size: ${fontSize.md};">
        <tr>
          <td style="padding: 8px 0; color: ${colors.textMuted};">Company Features</td>
          <td style="padding: 8px 0; text-align: right;">${formatPrice(companyFeaturesCost)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: ${colors.textMuted};">Employees (${maxEmployees} × ${formatPrice(perEmployeeCost)})</td>
          <td style="padding: 8px 0; text-align: right;">${formatPrice(perEmployeeCost * maxEmployees)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; padding-left: 20px; color: ${colors.textLight}; font-size: ${fontSize.sm};">Base rate: ${formatPrice(employeeRate)} × ${maxEmployees}</td>
          <td style="padding: 8px 0; text-align: right; color: ${colors.textLight}; font-size: ${fontSize.sm};">${formatPrice(employeeRate * maxEmployees)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; padding-left: 20px; color: ${colors.textLight}; font-size: ${fontSize.sm};">Features: ${formatPrice(employeeFeaturesCost)} × ${maxEmployees}</td>
          <td style="padding: 8px 0; text-align: right; color: ${colors.textLight}; font-size: ${fontSize.sm};">${formatPrice(employeeFeaturesCost * maxEmployees)}</td>
        </tr>
        <tr style="border-top: 2px solid ${colors.primary};">
          <td style="padding: 15px 0 0; font-size: ${fontSize.lg}; font-weight: ${fontWeight.bold};">Total Monthly</td>
          <td style="padding: 15px 0 0; text-align: right; font-size: ${fontSize.xl}; font-weight: ${fontWeight.bold}; color: ${colors.primary};">${formatPrice(monthlyPlanCost)}</td>
        </tr>
      </table>
    </div>

    ${paragraph(`If you have any questions or need assistance, please don't hesitate to reach out to our support team.`)}

    ${paragraph(`<strong>Best regards,</strong><br>The CleanManager Team`)}
  `

  const html = baseTemplate({
    title: `Welcome to CleanManager - ${companyName}`,
    modernStyle: true,
    headerIcon: '🏢',
    headerTitle: 'Welcome to CleanManager',
    bodyContent,
    companyName: 'CleanManager',
  })

  return sendEmail({
    to: adminEmail,
    subject: `Welcome to CleanManager - Your account for ${companyName} is ready!`,
    html,
    text: `Welcome ${adminFirstName} ${adminLastName}! Your company ${companyName} has been set up. Login: ${adminEmail} / ${password}. Monthly cost: ${formatPrice(monthlyPlanCost)}`,
  })
}

/**
 * Send email when features are added or removed from a company
 */
export async function sendFeatureUpdateEmail(data: FeatureUpdateEmailData): Promise<EmailResult> {
  const {
    companyName,
    companyEmail,
    adminFirstName,
    addedFeatures = [],
    removedFeatures = [],
    maxEmployees,
    employeeRate,
    oldMonthlyCost,
    newMonthlyCost,
  } = data

  const costDifference = newMonthlyCost - oldMonthlyCost
  const costChangeText = costDifference > 0 
    ? `increased by ${formatPrice(costDifference)}`
    : costDifference < 0 
      ? `decreased by ${formatPrice(Math.abs(costDifference))}`
      : 'remains the same'

  const addedFeaturesHtml = addedFeatures.length > 0
    ? `
      <h3 style="color: ${colors.success}; margin: 20px 0 10px;">✅ Features Added</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${addedFeatures.map(f => featureListItem(f.name, f.price, f.type, '+')).join('')}
      </table>`
    : ''

  const removedFeaturesHtml = removedFeatures.length > 0
    ? `
      <h3 style="color: ${colors.error}; margin: 20px 0 10px;">❌ Features Removed</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${removedFeatures.map(f => featureListItem(f.name, f.price, f.type, '-')).join('')}
      </table>`
    : ''

  const bodyContent = `
    ${greeting(`Hi ${adminFirstName},`)}
    
    ${paragraph(`We wanted to let you know that the features for <strong>${escapeHtml(companyName)}</strong> have been updated.`)}

    ${addedFeaturesHtml}
    ${removedFeaturesHtml}

    ${divider()}

    <div style="background: ${colors.bgLighter}; border-radius: ${borderRadius.lg}; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 15px;">📊 Pricing Update</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 8px 0; color: ${colors.textMuted};">Previous Monthly Cost</td>
          <td style="padding: 8px 0; text-align: right;">${formatPrice(oldMonthlyCost)}</td>
        </tr>
        <tr style="border-top: 1px solid #e0e0e0;">
          <td style="padding: 15px 0 0; font-weight: ${fontWeight.bold};">New Monthly Cost</td>
          <td style="padding: 15px 0 0; text-align: right; font-size: ${fontSize.lg}; font-weight: ${fontWeight.bold}; color: ${colors.primary};">${formatPrice(newMonthlyCost)}</td>
        </tr>
      </table>
      <p style="margin: 15px 0 0; font-size: ${fontSize.sm}; color: ${colors.textMuted};">
        Your monthly cost has ${costChangeText}.
      </p>
    </div>

    ${paragraph(`If you have any questions about these changes, please contact our support team.`)}

    ${paragraph(`<strong>Best regards,</strong><br>The CleanManager Team`)}
  `

  const html = baseTemplate({
    title: `Feature Update - ${companyName}`,
    modernStyle: false,
    headerIcon: '🔄',
    headerTitle: 'Feature Update',
    bodyContent,
    companyName: 'CleanManager',
  })

  return sendEmail({
    to: companyEmail,
    subject: `Feature update for ${companyName} - Monthly cost ${costChangeText}`,
    html,
    text: `Hi ${adminFirstName}, features have been updated for ${companyName}. Added: ${addedFeatures.map(f => f.name).join(', ')}. Removed: ${removedFeatures.map(f => f.name).join(', ')}. New monthly cost: ${formatPrice(newMonthlyCost)}.`,
  })
}

/**
 * Send company suspension notification email
 */
interface CompanySuspensionEmailData {
  companyName: string
  companyEmail: string
  adminEmail: string
  adminFirstName: string
  reason?: string
}

export async function sendCompanySuspensionEmail(data: CompanySuspensionEmailData): Promise<EmailResult> {
  const { companyName, companyEmail, adminEmail, adminFirstName, reason } = data

  const bodyContent = `
    ${greeting(`Dear ${escapeHtml(adminFirstName)}`)}
    
    <div style="background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-radius: ${borderRadius.lg}; padding: ${spacing.lg}; margin: ${spacing.lg} 0; border-left: 4px solid #DC2626;">
      <div style="display: flex; align-items: center; margin-bottom: ${spacing.md};">
        <span style="font-size: 28px; margin-right: ${spacing.sm};">⚠️</span>
        <h2 style="margin: 0; color: #DC2626; font-size: ${fontSize.xl}; font-weight: ${fontWeight.bold};">Account Suspended</h2>
      </div>
      <p style="margin: 0; color: ${colors.textDark}; font-size: ${fontSize.md};">
        Your company account <strong>${escapeHtml(companyName)}</strong> has been suspended.
      </p>
    </div>

    ${paragraph('During this suspension period:')}
    
    <ul style="color: ${colors.textMuted}; padding-left: ${spacing.lg}; margin: ${spacing.md} 0;">
      <li style="margin-bottom: ${spacing.sm};">All users will be unable to access the system</li>
      <li style="margin-bottom: ${spacing.sm};">Scheduled jobs and reminders are paused</li>
      <li style="margin-bottom: ${spacing.sm};">Your data remains safe and will be available when reactivated</li>
    </ul>

    ${reason ? `
      <div style="background: ${colors.bgLighter}; border-radius: ${borderRadius.md}; padding: ${spacing.md}; margin: ${spacing.md} 0;">
        <p style="margin: 0; color: ${colors.textMuted}; font-size: ${fontSize.sm};">
          <strong>Reason:</strong> ${escapeHtml(reason)}
        </p>
      </div>
    ` : ''}

    ${paragraph('If you believe this is an error or would like to discuss reactivation, please contact our support team.')}

    ${divider()}

    <div style="text-align: center; margin: ${spacing.xl} 0;">
      ${primaryButton('Contact Support', 'mailto:support@cleanmanager.io?subject=Account Suspension - ' + encodeURIComponent(companyName))}
    </div>

    ${paragraph('You can also reach us at:')}
    
    ${infoBox(`
      <p style="margin: 0 0 ${spacing.sm} 0;"><strong>Email:</strong> support@cleanmanager.io</p>
      <p style="margin: 0;"><strong>Phone:</strong> +44 20 1234 5678</p>
    `)}

    ${paragraph('We apologize for any inconvenience and look forward to resolving this matter promptly.')}
  `

  const html = baseTemplate({
    title: `Account Suspended - ${companyName}`,
    modernStyle: false,
    headerIcon: '⚠️',
    headerTitle: 'Account Suspended',
    bodyContent,
    companyName: 'CleanManager',
  })

  const textContent = `Dear ${adminFirstName}, your company account "${companyName}" has been suspended. All users will be unable to access the system until the account is reactivated. Please contact support@cleanmanager.io if you have any questions.`

  const recipients = Array.from(
    new Set([companyEmail, adminEmail].filter(Boolean))
  )

  if (recipients.length === 0) {
    throw new Error('No recipients provided for suspension email')
  }

  return sendEmail({
    to: recipients,
    subject: `⚠️ Account Suspended - ${companyName}`,
    html,
    text: textContent,
  })
}

/**
 * Send company reactivation notification email
 */
interface CompanyActivationEmailData {
  companyName: string
  companyEmail: string
  adminEmail: string
  adminFirstName: string
}

export async function sendCompanyActivationEmail(data: CompanyActivationEmailData): Promise<EmailResult> {
  const { companyName, companyEmail, adminEmail, adminFirstName } = data
  const loginUrl = buildAppUrl('/login')

  const bodyContent = `
    ${greeting(`Welcome back, ${escapeHtml(adminFirstName)}!`)}
    
    <div style="background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); border-radius: ${borderRadius.lg}; padding: ${spacing.lg}; margin: ${spacing.lg} 0; border-left: 4px solid #059669;">
      <div style="display: flex; align-items: center; margin-bottom: ${spacing.md};">
        <span style="font-size: 28px; margin-right: ${spacing.sm};">✅</span>
        <h2 style="margin: 0; color: #059669; font-size: ${fontSize.xl}; font-weight: ${fontWeight.bold};">Account Reactivated</h2>
      </div>
      <p style="margin: 0; color: ${colors.textDark}; font-size: ${fontSize.md};">
        Great news! Your company account <strong>${escapeHtml(companyName)}</strong> has been reactivated.
      </p>
    </div>

    ${paragraph('Your account is now fully active and all features have been restored:')}
    
    <ul style="color: ${colors.textMuted}; padding-left: ${spacing.lg}; margin: ${spacing.md} 0;">
      <li style="margin-bottom: ${spacing.sm};">✓ All users can now log in and access the system</li>
      <li style="margin-bottom: ${spacing.sm};">✓ Scheduled jobs and reminders are active again</li>
      <li style="margin-bottom: ${spacing.sm};">✓ All your data has been preserved</li>
    </ul>

    ${divider()}

    <div style="text-align: center; margin: ${spacing.xl} 0;">
      ${primaryButton('Log In Now', loginUrl)}
    </div>

    ${paragraph('Thank you for your continued trust in CleanManager. We\'re glad to have you back!')}

    ${infoBox(`
      <p style="margin: 0 0 ${spacing.sm} 0;"><strong>Need help?</strong></p>
      <p style="margin: 0;">Contact us at support@cleanmanager.io or call +44 20 1234 5678</p>
    `)}
  `

  const html = baseTemplate({
    title: `Account Reactivated - ${companyName}`,
    modernStyle: false,
    headerIcon: '✅',
    headerTitle: 'Account Reactivated',
    bodyContent,
    companyName: 'CleanManager',
  })

  const textContent = `Welcome back, ${adminFirstName}! Great news - your company account "${companyName}" has been reactivated. All users can now log in and access the system. All your data has been preserved. Log in at: ${loginUrl}`

  const recipients = Array.from(
    new Set([companyEmail, adminEmail].filter(Boolean))
  )

  if (recipients.length === 0) {
    throw new Error('No recipients provided for activation email')
  }

  return sendEmail({
    to: recipients,
    subject: `✅ Account Reactivated - ${companyName}`,
    html,
    text: textContent,
  })
}
