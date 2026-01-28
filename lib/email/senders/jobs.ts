/**
 * Job-related email senders
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
  badge,
} from '../templates/components'
import { formatDate, formatDateTime, formatTime } from '../utils'
import { getCurrencySymbol, colors, commonStyles } from '../styles'
import type {
  JobConfirmationEmailParams,
  JobAssignmentEmailParams,
  JobUnassignedEmailParams,
  JobReminderEmailParams,
  JobStartedEmailParams,
  JobCompletedEmailParams,
  JobCompletedToCompanyParams,
  JobCancelledEmailParams,
  JobRescheduledEmailParams,
  JobDeclinedNotificationParams,
  JobReassignedAcceptedParams,
  ShiftSwapRequestEmailParams,
  ShiftSwapDecisionEmailParams,
  EmployerCheckInNotificationParams,
  EmployerCheckOutNotificationParams,
} from '../types'

/**
 * Format address parts into a full address string, avoiding duplication
 * If location already contains city or postcode, they won't be duplicated
 */
function formatFullAddress(location?: string | null, city?: string | null, postcode?: string | null): string {
  if (!location && !city && !postcode) return ''
  
  const locationStr = (location || '').trim()
  const cityStr = (city || '').trim()
  const postcodeStr = (postcode || '').trim()
  
  // Check if location already contains city or postcode to avoid duplication
  const locationLower = locationStr.toLowerCase()
  const cityLower = cityStr.toLowerCase()
  const postcodeLower = postcodeStr.toLowerCase()
  
  const parts: string[] = []
  
  if (locationStr) {
    parts.push(locationStr)
  }
  
  // Only add city if it's not already in the location
  if (cityStr && !locationLower.includes(cityLower)) {
    parts.push(cityStr)
  }
  
  // Only add postcode if it's not already in the location
  if (postcodeStr && !locationLower.includes(postcodeLower)) {
    parts.push(postcodeStr)
  }
  
  return parts.join(', ')
}

/**
 * Send job confirmation email to customer
 */
export async function sendJobConfirmationEmail(params: JobConfirmationEmailParams) {
  const {
    to,
    customerName,
    jobTitle,
    jobDescription,
    scheduledDate,
    durationMinutes,
    location,
    city,
    postcode,
    accessInstructions,
    employeeName,
    companyName,
    companyPhone,
    companyEmail,
    jobUrl,
  } = params

  const dateStr = scheduledDate ? formatDate(scheduledDate) : 'To be confirmed'
  const timeStr = scheduledDate ? new Date(scheduledDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null
  const fullAddress = location

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Your cleaning service has been confirmed! Here are the details:`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Date', value: dateStr },
        { label: 'Time', value: timeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Address', value: fullAddress },
        { label: 'Cleaner', value: employeeName },
      ])}
    `, 'success')}
    ${jobDescription ? paragraph(`<strong>Service Details:</strong> ${escapeHtml(jobDescription)}`) : ''}
    ${accessInstructions ? alert(`Access Instructions: ${escapeHtml(accessInstructions)}`, 'info') : ''}
    ${jobUrl ? primaryButton('View in Customer Portal', jobUrl) : ''}
    ${paragraph(`<strong>Need to make changes?</strong> Contact us:`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Phone', value: companyPhone },
        { label: 'Email', value: companyEmail },
      ])}
    `)}
    ${mutedText('We look forward to serving you!')}
  `

  const html = baseTemplate({
    title: 'Job Confirmed',
    headerTitle: 'Booking Confirmed',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Booking Confirmed: ${jobTitle} on ${dateStr} - ${companyName}`,
    html,
  })
}

/**
 * Send job assignment email to employee
 */
export async function sendJobAssignmentEmail(params: JobAssignmentEmailParams) {
  const {
    employeeEmail,
    employeeName,
    jobTitle,
    jobDescription,
    scheduledDate,
    scheduledTime,
    address,
    customerName,
    customerPhone,
    companyName,
    estimatedDuration,
    specialInstructions,
    jobUrl,
  } = params

  const dateStr = formatDate(scheduledDate)

  const bodyContent = `
    ${greeting(employeeName)}
    ${paragraph(`You have been assigned to a new job. Please review the details below:`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Job', value: jobTitle },
        { label: 'Date', value: dateStr },
        { label: 'Time', value: scheduledTime },
        { label: 'Duration', value: estimatedDuration },
        { label: 'Address', value: address },
        { label: 'Customer', value: customerName },
        { label: 'Customer Phone', value: customerPhone },
      ])}
    `)}
    ${jobDescription ? paragraph(`<strong>Job Description:</strong> ${escapeHtml(jobDescription)}`) : ''}
    ${specialInstructions ? alert(`Special Instructions: ${escapeHtml(specialInstructions)}`, 'warning') : ''}
    ${primaryButton('View Job Details', jobUrl, 'gradient')}
    ${mutedText('Please ensure you arrive on time and check in when you start the job.')}
  `

  const html = baseTemplate({
    title: 'New Job Assignment',
    headerTitle: 'New Job Assigned',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: employeeEmail,
    subject: `New Job: ${jobTitle} on ${dateStr}`,
    html,
  })
}

/**
 * Notify an employee that they are no longer assigned to a job
 */
export async function sendJobUnassignedEmail(params: JobUnassignedEmailParams) {
  const {
    employeeEmail,
    employeeName,
    jobTitle,
    scheduledDate,
    companyName,
    newAssigneeName,
    jobUrl,
  } = params

  const dateStr = scheduledDate ? formatDate(scheduledDate) : null

  const bodyContent = `
    ${greeting(employeeName)}
    ${alert(`This job is no longer assigned to you.`, 'warning')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Job', value: jobTitle },
        { label: 'Scheduled Date', value: dateStr },
        { label: 'Reassigned To', value: newAssigneeName || null },
      ])}
    `, 'warning')}
    ${jobUrl ? primaryButton('View Job Details', jobUrl) : ''}
    ${mutedText('Your schedule has been updated accordingly.')}
  `

  const html = baseTemplate({
    title: 'Job Unassigned',
    headerTitle: 'Assignment Updated',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: employeeEmail,
    subject: dateStr
      ? `Job Unassigned: ${jobTitle} on ${dateStr}`
      : `Job Unassigned: ${jobTitle}`,
    html,
  })
}

/**
 * Send job reminder email to customer or employee
 */
export async function sendJobReminderEmail(params: JobReminderEmailParams) {
  const {
    to,
    recipientName,
    jobTitle,
    scheduledDate,
    durationMinutes,
    location,
    city,
    postcode,
    accessInstructions,
    employeeName,
    companyName,
    timeUntil,
    customMessage,
    isEmployeeReminder,
    customerName,
    rescheduleUrl,
  } = params

  const dateStr = formatDate(scheduledDate)
  const timeStr = new Date(scheduledDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null
  const fullAddress = location

  const bodyContent = isEmployeeReminder ? `
    ${greeting(recipientName)}
    ${alert(`Reminder: You have a job coming up ${timeUntil || 'soon'}!`, 'warning')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Job', value: jobTitle },
        { label: 'Date', value: dateStr },
        { label: 'Time', value: timeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Address', value: fullAddress },
        { label: 'Customer', value: customerName },
      ])}
    `)}
    ${accessInstructions ? alert(`Access Instructions: ${escapeHtml(accessInstructions)}`, 'info') : ''}
    ${customMessage ? paragraph(escapeHtml(customMessage)) : ''}
    ${mutedText('Remember to check in when you arrive at the location.')}
  ` : `
    ${greeting(recipientName)}
    ${alert(`Reminder: Your cleaning service is coming up ${timeUntil || 'soon'}!`, 'info')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Date', value: dateStr },
        { label: 'Time', value: timeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Address', value: fullAddress },
        { label: 'Cleaner', value: employeeName },
      ])}
    `)}
    ${accessInstructions ? alert(`Access Instructions: ${escapeHtml(accessInstructions)}`, 'info') : ''}
    ${customMessage ? paragraph(escapeHtml(customMessage)) : ''}
    ${rescheduleUrl ? primaryButton('Reschedule', rescheduleUrl) : ''}
    ${mutedText('We look forward to serving you!')}
  `

  const html = baseTemplate({
    title: 'Job Reminder',
    headerTitle: 'Upcoming Job Reminder',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Reminder: ${jobTitle} ${timeUntil || 'coming up soon'}`,
    html,
  })
}

/**
 * Send job started notification to customer
 */
export async function sendJobStartedEmail(params: JobStartedEmailParams) {
  const {
    to,
    customerName,
    jobTitle,
    employeeName,
    startedAt,
    companyName,
    estimatedDuration,
  } = params

  const startTimeStr = formatTime(startedAt)
  const durationStr = estimatedDuration ? `${estimatedDuration} minutes` : null

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Great news! Your cleaning service has started.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Cleaner', value: employeeName },
        { label: 'Started At', value: startTimeStr },
        { label: 'Estimated Duration', value: durationStr },
      ])}
    `, 'success')}
    ${paragraph(`${escapeHtml(employeeName)} is now working on your service. You'll receive another notification when the job is completed.`)}
    ${mutedText('Thank you for choosing our services!')}
  `

  const html = baseTemplate({
    title: 'Job Started',
    headerTitle: 'Cleaning In Progress',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Job Started: ${jobTitle} - ${companyName}`,
    html,
  })
}

/**
 * Send job completed notification to customer
 */
export async function sendJobCompletedEmail(params: JobCompletedEmailParams) {
  const {
    to,
    customerName,
    jobTitle,
    completedDate,
    durationMinutes,
    actualPrice,
    currency,
    employeeName,
    companyName,
    feedbackUrl,
    paymentUrl,
    invoiceNumber,
    pdfBuffer,
  } = params

  const completedTimeStr = formatDateTime(completedDate)
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null
  const currencySymbol = getCurrencySymbol(currency || 'GBP')

  const bodyContent = `
    ${greeting(customerName)}
    ${paragraph(`Your cleaning service has been completed!`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Completed By', value: employeeName },
        { label: 'Completed At', value: completedTimeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Amount Due', value: actualPrice ? `${currencySymbol}${actualPrice}` : null },
        { label: 'Invoice', value: invoiceNumber ? `#${invoiceNumber}` : null },
      ])}
    `, 'success')}
    ${paymentUrl ? `
      ${paragraph('Please complete your payment at your convenience:')}
      ${primaryButton('Pay Now', paymentUrl, 'success')}
    ` : ''}
    ${pdfBuffer ? mutedText('A PDF copy of your invoice is attached to this email.') : ''}
    ${feedbackUrl ? `
      ${paragraph('We would love to hear about your experience!')}
      ${primaryButton('Leave Feedback', feedbackUrl)}
    ` : ''}
    ${mutedText('Thank you for choosing our services. We hope to serve you again soon!')}
  `

  const html = baseTemplate({
    title: 'Job Completed',
    headerTitle: 'Job Completed',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: invoiceNumber 
      ? `Job Completed - Invoice #${invoiceNumber} - ${companyName}`
      : `Job Completed: ${jobTitle} - ${companyName}`,
    html,
    attachments: pdfBuffer ? [
      {
        filename: invoiceNumber ? `Invoice-${invoiceNumber}.pdf` : "Invoice.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ] : undefined,
  })
}

/**
 * Send job completed notification to company
 */
export async function sendJobCompletedToCompanyEmail(params: JobCompletedToCompanyParams) {
  const {
    companyEmail,
    companyName,
    jobId,
    jobTitle,
    customerName,
    customerEmail,
    employeeName,
    completedDate,
    durationMinutes,
    actualPrice,
    currency,
    location,
    dashboardUrl,
  } = params

  const completedTimeStr = formatDateTime(completedDate)
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null
  const currencySymbol = getCurrencySymbol(currency || 'GBP')

  const bodyContent = `
    ${paragraph(`A job has been completed by ${employeeName}.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Job', value: jobTitle },
        { label: 'Customer', value: customerName },
        { label: 'Customer Email', value: customerEmail },
        { label: 'Cleaner', value: employeeName },
        { label: 'Completed At', value: completedTimeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Location', value: location },
        { label: 'Amount', value: actualPrice ? `${currencySymbol}${actualPrice}` : null },
      ])}
    `, 'success')}
    ${primaryButton('View Job Details', `${dashboardUrl}/job/${jobId}`, 'success')}
    ${mutedText('The customer has been notified and sent payment details.')}
  `

  const html = baseTemplate({
    title: 'Job Completed',
    headerTitle: 'Job Completed by Cleaner',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: companyEmail,
    subject: `Job Completed: ${jobTitle} by ${employeeName}`,
    html,
  })
}

/**
 * Send job cancelled notification to customer or employee
 */
export async function sendJobCancelledEmail(params: JobCancelledEmailParams) {
  const {
    to,
    customerName,
    jobTitle,
    originalDate,
    companyName,
    reason,
    contactPhone,
    contactEmail,
    refundAmount,
    currency,
    isEmployeeNotification,
  } = params

  const dateStr = originalDate ? formatDate(originalDate) : 'Not specified'
  const currencySymbol = getCurrencySymbol(currency || 'GBP')

  const bodyContent = isEmployeeNotification ? `
    ${greeting(customerName)}
    ${paragraph(`A job you were assigned to has been cancelled.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Job', value: jobTitle },
        { label: 'Originally Scheduled', value: dateStr },
        { label: 'Reason', value: reason || 'Not specified' },
      ])}
    `, 'warning')}
    ${mutedText('Your schedule has been updated accordingly.')}
  ` : `
    ${greeting(customerName)}
    ${paragraph(`We regret to inform you that your scheduled cleaning service has been cancelled.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Service', value: jobTitle },
        { label: 'Originally Scheduled', value: dateStr },
        { label: 'Reason', value: reason || 'Not specified' },
        { label: 'Refund', value: refundAmount ? `${currencySymbol}${refundAmount}` : null },
      ])}
    `, 'warning')}
    ${paragraph(`We apologize for any inconvenience. Please contact us to reschedule:`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Phone', value: contactPhone },
        { label: 'Email', value: contactEmail },
      ])}
    `)}
    ${mutedText('We value your business and hope to serve you soon.')}
  `

  const html = baseTemplate({
    title: 'Job Cancelled',
    headerTitle: 'Booking Cancelled',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Booking Cancelled: ${jobTitle} - ${companyName}`,
    html,
  })
}

/**
 * Send job rescheduled notification to customer or employee
 */
export async function sendJobRescheduledEmail(params: JobRescheduledEmailParams) {
  const {
    to,
    customerName,
    jobTitle,
    originalDate,
    newDate,
    companyName,
    reason,
    location,
    durationMinutes,
    isEmployeeNotification,
    customerInfo,
  } = params

  const originalDateStr = originalDate ? formatDate(originalDate) : 'Previous date'
  const newDateStr = formatDate(newDate)
  const newTimeStr = new Date(newDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null

  const bodyContent = isEmployeeNotification ? `
    ${greeting(customerName)}
    ${paragraph(`A job assigned to you has been rescheduled.`)}
    ${infoBox(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 50%; padding: 10px;">
            <p style="margin: 0 0 5px; color: ${colors.textMuted}; font-size: 12px;">ORIGINAL DATE</p>
            <p style="margin: 0; color: ${colors.textSecondary}; text-decoration: line-through;">${originalDateStr}</p>
          </td>
          <td style="width: 50%; padding: 10px;">
            <p style="margin: 0 0 5px; color: ${colors.textMuted}; font-size: 12px;">NEW DATE</p>
            <p style="margin: 0; color: ${colors.success}; font-weight: 600;">${newDateStr} at ${newTimeStr}</p>
          </td>
        </tr>
      </table>
    `)}
    ${detailsTable([
      { label: 'Job', value: jobTitle },
      { label: 'Customer', value: customerInfo },
      { label: 'Location', value: location },
      { label: 'Duration', value: durationStr },
      { label: 'Reason', value: reason },
    ])}
    ${mutedText('Please update your schedule accordingly.')}
  ` : `
    ${greeting(customerName)}
    ${paragraph(`Your cleaning service has been rescheduled.`)}
    ${infoBox(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width: 50%; padding: 10px;">
            <p style="margin: 0 0 5px; color: ${colors.textMuted}; font-size: 12px;">ORIGINAL DATE</p>
            <p style="margin: 0; color: ${colors.textSecondary}; text-decoration: line-through;">${originalDateStr}</p>
          </td>
          <td style="width: 50%; padding: 10px;">
            <p style="margin: 0 0 5px; color: ${colors.textMuted}; font-size: 12px;">NEW DATE</p>
            <p style="margin: 0; color: ${colors.success}; font-weight: 600;">${newDateStr} at ${newTimeStr}</p>
          </td>
        </tr>
      </table>
    `)}
    ${detailsTable([
      { label: 'Service', value: jobTitle },
      { label: 'Location', value: location },
      { label: 'Reason', value: reason },
    ])}
    ${mutedText('If this new time does not work for you, please contact us to arrange an alternative.')}
  `

  const html = baseTemplate({
    title: 'Job Rescheduled',
    headerTitle: 'Booking Rescheduled',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Booking Rescheduled: ${jobTitle} - ${companyName}`,
    html,
  })
}

/**
 * Send shift swap request email to employee
 */
export async function sendShiftSwapRequestEmail(params: ShiftSwapRequestEmailParams) {
  const {
    to,
    employeeName,
    companyName,
    requestedByName,
    fromJobTitle,
    fromJobTime,
    toJobTitle,
    toJobTime,
    reason,
  } = params

  const bodyContent = `
    ${greeting(employeeName)}
    ${paragraph(`A shift swap has been requested involving your schedule.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Requested By', value: requestedByName },
        { label: 'Your Current Job', value: fromJobTitle },
        { label: 'Your Current Time', value: fromJobTime },
        { label: 'Swap To Job', value: toJobTitle },
        { label: 'Swap To Time', value: toJobTime },
        { label: 'Reason', value: reason },
      ])}
    `)}
    ${mutedText('A manager will review and approve or decline this request.')}
  `

  const html = baseTemplate({
    title: 'Shift Swap Request',
    headerTitle: 'Shift Swap Request',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Shift Swap Request - ${companyName}`,
    html,
  })
}

/**
 * Send shift swap decision email to employee
 */
export async function sendShiftSwapDecisionEmail(params: ShiftSwapDecisionEmailParams) {
  const {
    to,
    employeeName,
    companyName,
    status,
    jobTitle,
    jobTime,
    otherEmployeeName,
  } = params

  const approved = status === 'approved'
  const statusText = approved ? 'Approved' : 'Declined'
  const variant = approved ? 'success' : 'warning'

  const bodyContent = `
    ${greeting(employeeName)}
    ${paragraph(`Your shift swap request has been <strong>${statusText.toLowerCase()}</strong>.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Status', value: statusText },
        { label: 'Job', value: jobTitle },
        { label: 'Time', value: jobTime },
        { label: 'Swapped With', value: otherEmployeeName },
      ])}
    `, variant)}
    ${mutedText(approved 
      ? 'Your schedule has been updated accordingly.' 
      : 'If you have questions, please contact your manager.'
    )}
  `

  const html = baseTemplate({
    title: `Shift Swap ${statusText}`,
    headerTitle: `Shift Swap ${statusText}`,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Shift Swap ${statusText} - ${companyName}`,
    html,
  })
}

/**
 * Send check-in notification to employer
 */
export async function sendEmployerCheckInNotification(params: EmployerCheckInNotificationParams) {
  const {
    employerEmail,
    employerName,
    employeeName,
    customerName,
    jobTitle,
    jobId,
    checkInTime,
    location,
    companyName,
    dashboardUrl,
  } = params

  const checkInTimeStr = formatDateTime(checkInTime)

  const bodyContent = `
    ${greeting(employerName)}
    ${paragraph(`${escapeHtml(employeeName)} has checked in for a job.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Employee', value: employeeName },
        { label: 'Customer', value: customerName },
        { label: 'Job', value: jobTitle },
        { label: 'Check-in Time', value: checkInTimeStr },
        { label: 'Location', value: location },
      ])}
    `, 'success')}
    ${primaryButton('View Job Details', dashboardUrl)}
  `

  const html = baseTemplate({
    title: 'Employee Check-in',
    headerTitle: 'Employee Checked In',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: employerEmail,
    subject: `Check-in: ${employeeName} - ${jobTitle}`,
    html,
  })
}

/**
 * Send check-out notification to employer
 */
export async function sendEmployerCheckOutNotification(params: EmployerCheckOutNotificationParams) {
  const {
    employerEmail,
    employerName,
    employeeName,
    customerName,
    jobTitle,
    jobId,
    checkOutTime,
    location,
    durationMinutes,
    comment,
    companyName,
    dashboardUrl,
  } = params

  const checkOutTimeStr = formatTime(checkOutTime)
  const durationStr = durationMinutes ? `${durationMinutes} minutes` : null

  const bodyContent = `
    ${greeting(employerName)}
    ${paragraph(`${escapeHtml(employeeName)} has completed a job.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Employee', value: employeeName },
        { label: 'Customer', value: customerName },
        { label: 'Job', value: jobTitle },
        { label: 'Check-out Time', value: checkOutTimeStr },
        { label: 'Duration', value: durationStr },
        { label: 'Cleaner Comment', value: comment || null },
        { label: 'Location', value: location },
      ])}
    `, 'success')}
    ${primaryButton('View Job Details', dashboardUrl)}
  `

  const html = baseTemplate({
    title: 'Employee Check-out',
    headerTitle: 'Job Completed',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: employerEmail,
    subject: `Job Completed: ${employeeName} - ${jobTitle}`,
    html,
  })
}

/**
 * Send job declined notification
 */
export async function sendJobDeclinedNotification(params: JobDeclinedNotificationParams) {
  const {
    to,
    companyName,
    jobTitle,
    employeeName,
    scheduledDate,
    jobUrl,
  } = params

  const dateStr = formatDate(scheduledDate)

  const bodyContent = `
    ${paragraph(`An employee has declined a job assignment.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Employee', value: employeeName },
        { label: 'Job', value: jobTitle },
        { label: 'Scheduled Date', value: dateStr },
      ])}
    `, 'warning')}
    ${paragraph('Please reassign this job to another employee.')}
    ${primaryButton('View Job', jobUrl)}
  `

  const html = baseTemplate({
    title: 'Job Declined',
    headerTitle: 'Job Declined',
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Job Declined by ${employeeName}: ${jobTitle}`,
    html,
  })
}

/**
 * Send job reassigned and accepted notification
 */
export async function sendJobReassignedAcceptedNotification(params: JobReassignedAcceptedParams) {
  const {
    to,
    companyName,
    jobTitle,
    employeeName,
    scheduledDate,
    jobUrl,
  } = params

  const dateStr = formatDate(scheduledDate)

  const bodyContent = `
    ${paragraph(`A job has been accepted after reassignment.`)}
    ${infoBox(`
      ${detailsTable([
        { label: 'Employee', value: employeeName },
        { label: 'Job', value: jobTitle },
        { label: 'Scheduled Date', value: dateStr },
      ])}
    `, 'success')}
    ${primaryButton('View Job Details', jobUrl, 'success')}
  `

  const html = baseTemplate({
    title: 'Job Accepted',
    headerTitle: 'Job Accepted',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to,
    subject: `Job Accepted: ${employeeName} confirmed for ${jobTitle}`,
    html,
  })
}
