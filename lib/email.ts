/**
 * Email service - Re-exports from modular email package
 * 
 * This file maintains backward compatibility with existing imports.
 * The email service has been refactored into a modular structure
 * located in lib/email/ directory.
 * 
 * Structure:
 *   lib/email/
 *     index.ts          - Main exports
 *     types.ts          - All TypeScript interfaces
 *     styles.ts         - Color/font/spacing constants
 *     utils.ts          - Utility functions
 *     transporter.ts    - SMTP configuration with retry logic
 *     templates/
 *       base.ts         - Base HTML template wrapper
 *       components.ts   - Reusable email components
 *     senders/
 *       auth.ts         - Authentication emails
 *       quotes.ts       - Quote emails
 *       jobs.ts         - Job notification emails
 *       invoicing.ts    - Invoice & payment emails
 *       booking.ts      - Booking emails
 * 
 * Usage remains the same:
 * ```typescript
 * import { sendVerificationEmail, sendInvoiceEmail } from '@/lib/email'
 * ```
 */

// Re-export everything from the modular email package
export * from './email/index'
