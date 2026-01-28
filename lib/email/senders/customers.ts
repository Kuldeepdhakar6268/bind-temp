/**
 * Customer account status email senders
 */

import { sendEmail } from '../transporter'
import { baseTemplate } from '../templates/base'
import { greeting, paragraph, infoBox, detailsTable, mutedText, alert } from '../templates/components'
import type { CustomerStatusEmailParams } from '../types'

export async function sendCustomerDeactivatedEmail(params: CustomerStatusEmailParams) {
  const {
    customerEmail,
    customerName,
    companyName,
    companyEmail,
    companyPhone,
  } = params

  const bodyContent = `
    ${greeting(customerName)}
    ${alert(`Your account with ${companyName} has been deactivated.`, 'warning')}
    ${paragraph('Your account is currently inactive. If you believe this is a mistake, please contact us for assistance.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Company', value: companyName },
        { label: 'Email', value: companyEmail || null },
        { label: 'Phone', value: companyPhone || null },
        { label: 'Status', value: 'Inactive' },
      ])}
    `, 'warning')}
    ${mutedText('Your account data and history remain safe and can be reactivated at any time.')}
  `

  const html = baseTemplate({
    title: 'Account Deactivated',
    headerTitle: 'Account Deactivated',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Account Deactivated - ${companyName}`,
    html,
  })
}

export async function sendCustomerReactivatedEmail(params: CustomerStatusEmailParams) {
  const {
    customerEmail,
    customerName,
    companyName,
    companyEmail,
    companyPhone,
  } = params

  const bodyContent = `
    ${greeting(customerName)}
    ${alert(`Your account with ${companyName} has been reactivated.`, 'success')}
    ${paragraph('Your account is now active again. You can continue booking services with us.')}
    ${infoBox(`
      ${detailsTable([
        { label: 'Company', value: companyName },
        { label: 'Email', value: companyEmail || null },
        { label: 'Phone', value: companyPhone || null },
        { label: 'Status', value: 'Active' },
      ])}
    `, 'success')}
    ${mutedText('Thank you for choosing our services.')}
  `

  const html = baseTemplate({
    title: 'Account Reactivated',
    headerTitle: 'Account Reactivated',
    modernStyle: true,
    bodyContent,
    companyName,
  })

  return sendEmail({
    to: customerEmail,
    subject: `Account Reactivated - ${companyName}`,
    html,
  })
}
