/**
 * Main email module - exports all email functions and utilities
 * 
 * This module provides a complete email service with:
 * - Centralized transporter with retry logic
 * - Reusable template components
 * - Type-safe email senders for all use cases
 * 
 * Usage:
 * ```typescript
 * import { sendVerificationEmail, sendInvoiceEmail } from '@/lib/email'
 * ```
 */

// Re-export types
export * from './types'

// Re-export utilities
export {
  validateEmail,
  stripHtml,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatCurrency,
  formatPhone,
  getAppUrl,
  buildAppUrl,
  truncate,
  capitalize,
  slugify,
  getOrdinalSuffix,
} from './utils'

// Re-export style constants
export {
  colors,
  fonts,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  commonStyles,
  currencySymbols,
  getCurrencySymbol,
} from './styles'

// Re-export template helpers
export {
  baseTemplate,
  simpleTemplate,
  escapeHtml,
  safeUrl,
} from './templates/base'

export {
  primaryButton,
  linkText,
  infoBox,
  detailRow,
  detailsTable,
  badge,
  divider,
  greeting,
  paragraph,
  mutedText,
  itemsTable,
  totalRow,
  totalsSummary,
  noteSection,
  alert,
} from './templates/components'

// Re-export transporter functions
export {
  sendEmail,
  isEmailConfigured,
  verifyConnection,
  closeTransporter,
  getEmailConfig,
} from './transporter'

// Auth email senders
export {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmployeeCredentialsEmail,
  sendCustomerPortalLoginCode,
} from './senders/auth'

// Quote email senders
export {
  sendQuoteEmail,
  sendQuoteAcceptedNotification,
  sendQuoteRejectedNotification,
  sendQuoteFollowUp,
} from './senders/quotes'

// Job email senders
export {
  sendJobConfirmationEmail,
  sendJobAssignmentEmail,
  sendJobUnassignedEmail,
  sendJobReminderEmail,
  sendJobStartedEmail,
  sendJobCompletedEmail,
  sendJobCompletedToCompanyEmail,
  sendJobCancelledEmail,
  sendJobRescheduledEmail,
  sendShiftSwapRequestEmail,
  sendShiftSwapDecisionEmail,
  sendEmployerCheckInNotification,
  sendEmployerCheckOutNotification,
  sendJobDeclinedNotification,
  sendJobReassignedAcceptedNotification,
} from './senders/jobs'

// Invoice & payment email senders
export {
  sendInvoiceEmail,
  sendInvoiceWithPDFEmail,
  sendPaymentRequestEmail,
  sendPaymentReminderEmail,
  sendPaymentReceiptEmail,
} from './senders/invoicing'

// Booking email senders
export {
  sendBookingRequestAcknowledgmentEmail,
  sendNewBookingRequestToCompanyEmail,
  sendBookingCancelledEmail,
  sendBookingCancelledToCompanyEmail,
  sendBookingModifiedEmail,
  sendBookingModifiedToCompanyEmail,
  sendFeedbackRequestEmail,
} from './senders/booking'

// Customer email senders
export {
  sendCustomerDeactivatedEmail,
  sendCustomerReactivatedEmail,
} from './senders/customers'

// Admin email senders
export {
  sendWelcomeCompanyEmail,
  sendFeatureUpdateEmail,
  sendCompanySuspensionEmail,
  sendCompanyActivationEmail,
} from './senders/admin'



