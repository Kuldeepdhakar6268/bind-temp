/**
 * Booking-related email senders
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
  alert,
} from '../templates/components'
import { formatDate, formatDateTime } from '../utils'
import { colors } from '../styles'
import type {
  BookingRequestAcknowledgmentParams,
  NewBookingRequestToCompanyParams,
  BookingCancelledEmailParams,
  BookingCancelledToCompanyParams,
  BookingModifiedEmailParams,
  BookingModifiedToCompanyParams,
  FeedbackRequestEmailParams,
} from '../types'

/**
 * Send booking request acknowledgment to customer
 */
export async function sendBookingRequestAcknowledgmentEmail(params: BookingRequestAcknowledgmentParams) {
  const {
    to,
    customerName,
    serviceType,
    preferredDate,
    preferredTimeSlot,
    address,
    city,
    postcode,
    estimatedPrice,
    frequency,
    companyName,
    companyPhone,
    companyEmail,
    portalUrl,
  } = params

  const dateStr = preferredDate ? formatDate(preferredDate) : 'To be confirmed'
  const fullAddress = [address, city, postcode].filter(Boolean).join(', ')
  const frequencyLabel = frequency === 'one_time' ? 'One-time' : frequency?.replace('_', ' ') || 'One-time'

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph('Thank you for your booking request! We have received your enquiry and will be in touch shortly.')}
    ${infoBox(`
      <p style="margin: 0 0 15px; font-weight: 600; color: ${colors.textDark};">Booking Details</p>
      ${detailsTable([
        { label: 'Service', value: serviceType },
        { label: 'Preferred Date', value: dateStr },
        { label: 'Preferred Time', value: preferredTimeSlot || 'Flexible' },
        { label: 'Address', value: fullAddress },
        { label: 'Frequency', value: frequencyLabel },
        { label: 'Estimated Price', value: estimatedPrice ? `&#8364;${estimatedPrice}` : 'Quote pending' },
      ])}
    `)}
    ${paragraph('We will review your request and confirm availability within 24 hours.')}
    ${primaryButton('View Your Booking', portalUrl, 'gradient')}
    ${paragraph(`<strong>Questions?</strong> Contact us:`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Phone', value: companyPhone || 'See website' },
        { label: 'Email', value: companyEmail || 'See website' },
      ])}
    `)}
    ${mutedText('Thank you for choosing our services!')}
  `

  const html = baseTemplate({
    title: 'Booking Request Received',
    headerTitle: 'Booking Request Received',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Booking Request Received - ${companyName}`,
    html,
  })
}

/**
 * Send new booking request notification to company
 */
export async function sendNewBookingRequestToCompanyEmail(params: NewBookingRequestToCompanyParams) {
  const {
    companyEmail,
    companyName,
    customerName,
    customerEmail: custEmail,
    customerPhone,
    serviceType,
    preferredDate,
    preferredTimeSlot,
    address,
    city,
    postcode,
    estimatedPrice,
    frequency,
    specialRequirements,
    bookingId,
    dashboardUrl,
  } = params

  const dateStr = preferredDate ? formatDate(preferredDate) : 'To be confirmed'
  const fullAddress = [address, city, postcode].filter(Boolean).join(', ')
  const frequencyLabel = frequency === 'one_time' ? 'One-time' : frequency?.replace('_', ' ') || 'One-time'

  const bodyContent = `
    ${paragraph('You have received a new booking request!')}
    ${infoBox(`
      <p style="margin: 0 0 15px; font-weight: 600; color: ${colors.textDark};">Customer Information</p>
      ${detailsTable([
        { label: 'Name', value: customerName },
        { label: 'Email', value: custEmail },
        { label: 'Phone', value: customerPhone || 'Not provided' },
      ])}
    `)}
    ${infoBox(`
      <p style="margin: 0 0 15px; font-weight: 600; color: ${colors.textDark};">Booking Details</p>
      ${detailsTable([
        { label: 'Service', value: serviceType },
        { label: 'Preferred Date', value: dateStr },
        { label: 'Preferred Time', value: preferredTimeSlot || 'Flexible' },
        { label: 'Address', value: fullAddress },
        { label: 'Frequency', value: frequencyLabel },
        { label: 'Estimated Price', value: estimatedPrice ? `&#8364;${estimatedPrice}` : 'To be quoted' },
        { label: 'Special Requirements', value: specialRequirements || 'None' },
      ])}
    `)}
    ${primaryButton('Review Booking', dashboardUrl, 'gradient')}
    ${mutedText('Please respond to this request within 24 hours.')}
  `

  const html = baseTemplate({
    title: 'New Booking Request',
    headerTitle: 'New Booking Request',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `New Booking Request: ${customerName} - ${serviceType}`,
    html,
  })
}

/**
 * Send booking cancelled email to customer
 */
export async function sendBookingCancelledEmail(params: BookingCancelledEmailParams) {
  const {
    customerEmail,
    customerName,
    bookingId,
    serviceType,
    preferredDate,
    companyName,
  } = params

  const dateStr = preferredDate ? formatDate(preferredDate) : 'Not specified'

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph('Your booking has been cancelled as requested.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: serviceType },
        { label: 'Scheduled Date', value: dateStr },
      ])}
    `, 'warning')}
    ${paragraph('If you would like to book again in the future, we would be happy to help.')}
    ${mutedText('We hope to serve you again soon.')}
  `

  const html = baseTemplate({
    title: 'Booking Cancelled',
    headerTitle: 'Booking Cancelled',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Booking Cancelled - ${companyName}`,
    html,
  })
}

/**
 * Send booking cancelled notification to company
 */
export async function sendBookingCancelledToCompanyEmail(params: BookingCancelledToCompanyParams) {
  const {
    companyEmail,
    companyName,
    customerName,
    customerEmail: custEmail,
    customerPhone,
    bookingId,
    serviceType,
    preferredDate,
    address,
    city,
    cancellationReason,
  } = params

  const dateStr = preferredDate ? formatDate(preferredDate) : 'Not specified'
  const fullAddress = [address, city].filter(Boolean).join(', ')

  const bodyContent = `
    ${paragraph('A booking has been cancelled by the customer.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Customer', value: customerName },
        { label: 'Email', value: custEmail },
        { label: 'Phone', value: customerPhone || 'Not provided' },
        { label: 'Service', value: serviceType },
        { label: 'Scheduled Date', value: dateStr },
        { label: 'Address', value: fullAddress },
        { label: 'Reason', value: cancellationReason },
      ])}
    `, 'warning')}
    ${mutedText('The customer has been notified of the cancellation.')}
  `

  const html = baseTemplate({
    title: 'Booking Cancelled',
    headerTitle: 'Booking Cancelled by Customer',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `Booking Cancelled: ${customerName}`,
    html,
  })
}

/**
 * Send booking modified email to customer
 */
export async function sendBookingModifiedEmail(params: BookingModifiedEmailParams) {
  const {
    customerEmail,
    customerName,
    bookingId,
    serviceType,
    changes,
    newPreferredDate,
    companyName,
  } = params

  const newDateStr = newPreferredDate ? formatDate(newPreferredDate) : 'To be confirmed'
  const changesStr = changes.length > 0 ? changes.join(', ') : 'Details updated'

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph('Your booking has been modified successfully.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: serviceType },
        { label: 'New Date', value: newDateStr },
        { label: 'Changes Made', value: changesStr },
      ])}
    `)}
    ${paragraph('If you have any questions about these changes, please contact us.')}
    ${mutedText('Thank you for your flexibility!')}
  `

  const html = baseTemplate({
    title: 'Booking Modified',
    headerTitle: 'Booking Updated',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Booking Modified - ${companyName}`,
    html,
  })
}

/**
 * Send booking modified notification to company
 */
export async function sendBookingModifiedToCompanyEmail(params: BookingModifiedToCompanyParams) {
  const {
    companyEmail,
    companyName,
    customerName,
    customerEmail: custEmail,
    customerPhone,
    bookingId,
    serviceType,
    changes,
    newPreferredDate,
    address,
    city,
  } = params

  const newDateStr = newPreferredDate ? formatDate(newPreferredDate) : 'To be confirmed'
  const fullAddress = [address, city].filter(Boolean).join(', ')
  const changesStr = changes.length > 0 ? changes.join(', ') : 'Details updated'

  const bodyContent = `
    ${paragraph('A booking has been modified by the customer.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Customer', value: customerName },
        { label: 'Email', value: custEmail },
        { label: 'Phone', value: customerPhone || 'Not provided' },
        { label: 'Service', value: serviceType },
        { label: 'New Date', value: newDateStr },
        { label: 'Address', value: fullAddress },
        { label: 'Changes', value: changesStr },
      ])}
    `)}
    ${mutedText('Please update your schedule accordingly.')}
  `

  const html = baseTemplate({
    title: 'Booking Modified',
    headerTitle: 'Booking Modified by Customer',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `Booking Modified: ${customerName}`,
    html,
  })
}

/**
 * Send feedback request email
 */
export async function sendFeedbackRequestEmail(params: FeedbackRequestEmailParams) {
  const {
    customerEmail,
    customerName,
    jobTitle,
    completedAt,
    companyName,
    feedbackUrl,
  } = params

  const completedAtStr = formatDate(completedAt)

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Thank you for using our cleaning services on ${completedAtStr}!`)}
    ${paragraph('We would love to hear about your experience. Your feedback helps us improve and serve you better.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Completed', value: completedAtStr },
      ])}
    `)}
    ${primaryButton('Leave Feedback', feedbackUrl, 'gradient')}
    ${paragraph('It only takes a minute and means a lot to us!')}
    ${mutedText('If you have any concerns, please reply to this email and we will address them promptly.')}
  `

  const html = baseTemplate({
    title: 'How did we do?',
    headerTitle: 'How did we do?',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `How was your cleaning service? - ${companyName}`,
    html,
  })
}
