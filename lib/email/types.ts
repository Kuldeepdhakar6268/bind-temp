/**
 * Centralized type definitions for the email service
 */

export interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailResult {
  success: boolean
  id: string
}

// Auth Email Types
export interface VerificationEmailParams {
  email: string
  verificationToken: string
  userName: string
}

export interface PasswordResetEmailParams {
  email: string
  resetToken: string
  userName: string
}

export interface WelcomeEmailParams {
  email: string
  userName: string
  companyName: string
}

export interface EmployeeCredentialsEmailParams {
  email: string
  name: string
  password: string
  companyName: string
  loginUrl: string
}

export interface CustomerPortalLoginParams {
  email: string
  customerName: string
  loginCode: string
  companyName: string
  expiresInMinutes?: number
}

// Customer Status Email Types
export interface CustomerStatusEmailParams {
  customerEmail: string
  customerName: string
  companyName: string
  companyEmail?: string | null
  companyPhone?: string | null
}


// Quote Email Types
export interface QuoteEmailParams {
  customerEmail: string
  customerName: string
  quoteNumber: string
  title?: string | null
  items: QuoteItem[]
  subtotal: string | null
  taxRate?: string | null
  taxAmount?: string | null
  discountAmount?: string | null
  total: string | null
  currency: string
  validUntil?: Date | null
  notes?: string | null
  terms?: string | null
  companyName: string
  companyLogo?: string | null
  viewUrl: string
}

export interface QuoteItem {
  title: string
  description?: string | null
  quantity: string | null
  unitPrice: string | null
  amount: string | null
}

export interface QuoteAcceptedParams {
  companyEmail: string
  companyName: string
  customerName: string
  quoteNumber: string
  quoteTitle?: string | null
  total: string
  currency: string
}

export interface QuoteRejectedParams {
  companyEmail: string
  companyName: string
  customerName: string
  quoteNumber: string
  quoteTitle?: string | null
  reason?: string | null
}

export interface QuoteFollowUpParams {
  customerEmail: string
  customerName: string
  quoteNumber: string
  title?: string | null
  total: string
  currency: string
  validUntil?: Date | null
  companyName: string
  viewUrl: string
}

// Job Email Types
export interface JobConfirmationEmailParams {
  to: string
  customerName: string
  jobTitle: string
  jobDescription?: string | null
  scheduledDate: Date | null
  scheduledEndDate?: Date | null
  durationMinutes?: number | null
  location?: string | null
  city?: string | null
  postcode?: string | null
  accessInstructions?: string | null
  estimatedPrice?: string | null
  currency?: string | null
  employeeName?: string | null
  companyName: string
  companyPhone?: string | null
  companyEmail?: string | null
  customMessage?: string | null
  jobUrl?: string | null
  rescheduleUrl?: string | null
}

export interface JobAssignmentEmailParams {
  employeeEmail: string
  employeeName: string
  jobTitle: string
  jobDescription?: string | null
  scheduledDate: Date
  scheduledTime?: string | null
  address: string
  customerName: string
  customerPhone?: string | null
  companyName: string
  estimatedDuration?: string | null
  specialInstructions?: string | null
  jobUrl: string
}

export interface JobUnassignedEmailParams {
  employeeEmail: string
  employeeName: string
  jobTitle: string
  scheduledDate?: Date | null
  companyName: string
  newAssigneeName?: string | null
  jobUrl?: string | null
}

export interface JobReminderEmailParams {
  to: string
  recipientName: string
  jobTitle: string
  scheduledDate: Date
  durationMinutes?: number | null
  location?: string | null
  city?: string | null
  postcode?: string | null
  accessInstructions?: string | null
  employeeName?: string | null
  companyName: string
  companyPhone?: string | null
  timeUntil?: string | null
  customMessage?: string | null
  isEmployeeReminder?: boolean
  customerName?: string | null
  rescheduleUrl?: string | null
  jobUrl?: string | null
}

export interface JobStartedEmailParams {
  to: string
  customerName: string
  jobTitle: string
  jobDescription?: string | null
  startedAt: Date
  estimatedDuration?: number | null
  location?: string | null
  employeeName: string
  companyName: string
  companyPhone?: string | null
}

export interface JobCompletedEmailParams {
  to: string
  customerName: string
  jobTitle: string
  jobDescription?: string | null
  completedDate: Date
  durationMinutes?: number | null
  actualPrice?: string | null
  currency?: string | null
  employeeName: string
  companyName: string
  feedbackUrl?: string | null
  paymentUrl?: string | null
  invoiceNumber?: string | null
  /** Optional PDF invoice attachment */
  pdfBuffer?: Buffer
}

export interface JobCompletedToCompanyParams {
  companyEmail: string
  companyName: string
  jobId: number
  jobTitle: string
  customerName: string
  customerEmail: string
  employeeName: string
  completedDate: Date
  durationMinutes?: number | null
  actualPrice?: string | null
  currency?: string | null
  location?: string | null
  dashboardUrl: string
}

export interface JobCancelledEmailParams {
  to: string
  customerName: string
  jobTitle: string
  originalDate: Date | null
  reason?: string | null
  companyName: string
  contactEmail?: string | null
  contactPhone?: string | null
  refundAmount?: string | null
  currency?: string | null
  isEmployeeNotification?: boolean
}

export interface JobRescheduledEmailParams {
  to: string
  customerName: string
  jobTitle: string
  originalDate: Date | null
  newDate: Date
  reason?: string | null
  companyName: string
  location?: string | null
  durationMinutes?: number | null
  isEmployeeNotification?: boolean
  customerInfo?: string | null
}

export interface JobDeclinedNotificationParams {
  to: string
  companyName: string
  jobTitle: string
  employeeName: string
  scheduledDate: Date
  jobUrl: string
}

export interface JobReassignedAcceptedParams {
  to: string
  companyName: string
  jobTitle: string
  employeeName: string
  scheduledDate: Date
  jobUrl: string
}

// Shift Swap Types
export interface ShiftSwapRequestEmailParams {
  to: string
  employeeName: string
  companyName: string
  requestedByName: string
  fromJobTitle: string
  fromJobTime: string
  toJobTitle: string
  toJobTime: string
  reason?: string | null
}

export interface ShiftSwapDecisionEmailParams {
  to: string
  employeeName: string
  companyName: string
  status: 'approved' | 'rejected'
  jobTitle: string
  jobTime: string
  otherEmployeeName: string
}

// Check-in/out Types
export interface EmployerCheckInNotificationParams {
  employerEmail: string
  employerName: string
  employeeName: string
  customerName: string
  jobTitle: string
  jobId: number
  checkInTime: Date
  location: string
  companyName: string
  dashboardUrl: string
}

export interface EmployerCheckOutNotificationParams {
  employerEmail: string
  employerName: string
  employeeName: string
  customerName: string
  jobTitle: string
  jobId: number
  checkOutTime: Date
  location: string
  durationMinutes: number
  comment?: string | null
  companyName: string
  dashboardUrl: string
}

// Payment Types
export interface PaymentRequestEmailParams {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  amount: string
  currency: string
  dueDate: Date
  companyName: string
  paymentUrl: string
  description?: string | null
  /** Optional PDF invoice attachment */
  pdfBuffer?: Buffer
}

export interface PaymentReminderEmailParams {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  amount: string
  currency: string
  dueDate: Date
  daysOverdue: number
  companyName: string
  paymentUrl: string
  /** Optional PDF invoice attachment */
  pdfBuffer?: Buffer
}

export interface PaymentReceiptEmailParams {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  amount: string
  currency: string
  paidAt: Date
  paymentMethod: string
  companyName: string
}

// Invoice Types
export interface InvoiceEmailParams {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  amount: string
  currency: string
  dueDate: Date
  companyName: string
  viewUrl: string
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: string
  amount: string
}

export interface InvoiceWithPDFEmailParams {
  customerEmail: string
  customerName: string
  invoiceNumber: string
  amount: string
  currency: string
  dueDate: Date
  companyName: string
  viewUrl: string
  pdfBuffer: Buffer
}

// Feedback Types
export interface FeedbackRequestEmailParams {
  customerEmail: string
  customerName: string
  jobTitle: string
  completedAt: Date
  companyName: string
  feedbackUrl: string
}

// Booking Types
export interface BookingRequestAcknowledgmentParams {
  to: string
  customerName: string
  serviceType: string
  preferredDate: Date | null
  preferredTimeSlot?: string | null
  address: string
  city?: string | null
  postcode?: string | null
  estimatedPrice?: string | null
  frequency?: string
  companyName: string
  companyPhone?: string | null
  companyEmail?: string | null
  portalUrl: string
}

export interface NewBookingRequestToCompanyParams {
  companyEmail: string
  companyName: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  serviceType: string
  preferredDate: Date | null
  preferredTimeSlot?: string | null
  address: string
  city?: string | null
  postcode?: string | null
  estimatedPrice?: string | null
  frequency?: string
  specialRequirements?: string | null
  bookingId: string
  dashboardUrl: string
}

export interface BookingCancelledEmailParams {
  customerEmail: string
  customerName: string
  bookingId: string
  serviceType: string
  preferredDate: Date | null
  companyName: string
}

export interface BookingCancelledToCompanyParams {
  companyEmail: string
  companyName: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  bookingId: string
  serviceType: string
  preferredDate: Date | null
  address: string
  city?: string
  cancellationReason: string
}

export interface BookingModifiedEmailParams {
  customerEmail: string
  customerName: string
  bookingId: string
  serviceType: string
  changes: string[]
  newPreferredDate: Date | null
  companyName: string
}

export interface BookingModifiedToCompanyParams {
  companyEmail: string
  companyName: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  bookingId: string
  serviceType: string
  changes: string[]
  newPreferredDate: Date | null
  address: string
  city?: string
}

// Email Configuration
export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  fromEmail: string
  fromName: string
}

// Retry Configuration
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}



