/**
 * Centralized style constants for email templates
 * Ensures consistency across all emails and makes updates easy
 */

export const colors = {
  // Primary colors
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',
  
  // Gradient
  gradientStart: '#4F46E5',
  gradientEnd: '#4338CA',
  
  // Text colors
  textDark: '#1a1a1a',
  textPrimary: '#333333',
  textSecondary: '#4a4a4a',
  textMuted: '#6b6b6b',
  textLight: '#64748b',
  textLink: '#2563eb',
  
  // Status colors
  success: '#16a34a',
  successLight: '#166534',
  successBg: '#dcfce7',
  warning: '#ca8a04',
  warningBg: '#fef9c3',
  error: '#dc2626',
  errorBg: '#fee2e2',
  info: '#0284c7',
  infoBg: '#e0f2fe',
  
  // Background colors
  bgLight: '#f5f5f5',
  bgLighter: '#f8fafc',
  bgWhite: '#ffffff',
  bgFooter: '#f9f9f9',
  
  // Border colors
  border: '#e5e5e5',
  borderLight: '#f0f0f0',
} as const

export const fonts = {
  primary: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
} as const

export const spacing = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '30px',
  xxl: '40px',
} as const

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
} as const

export const fontSize = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '24px',
  xxl: '32px',
} as const

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

// Common style patterns as inline CSS strings
export const commonStyles = {
  body: `margin: 0; padding: 0; font-family: ${fonts.primary}; background-color: ${colors.bgLight};`,
  
  outerTable: `background-color: ${colors.bgLight}; padding: 40px 20px;`,
  
  contentTable: `background-color: ${colors.bgWhite}; border-radius: ${borderRadius.lg}; box-shadow: 0 2px 8px rgba(0,0,0,0.1);`,
  
  contentTableModern: `background-color: ${colors.bgWhite}; border-radius: ${borderRadius.xl}; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);`,
  
  headerCell: `padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid ${colors.border};`,
  
  headerGradient: `padding: 35px 40px; background: linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientEnd} 100%); border-radius: ${borderRadius.xl} ${borderRadius.xl} 0 0;`,
  
  bodyCell: `padding: 40px;`,
  
  footerCell: `padding: 30px 40px; background-color: ${colors.bgFooter}; border-top: 1px solid ${colors.border}; border-radius: 0 0 ${borderRadius.lg} ${borderRadius.lg};`,
  
  heading1: `margin: 0; color: ${colors.textDark}; font-size: ${fontSize.xl}; font-weight: ${fontWeight.semibold};`,
  
  heading1White: `margin: 0; color: ${colors.bgWhite}; font-size: ${fontSize.xl}; font-weight: ${fontWeight.semibold};`,
  
  paragraph: `margin: 0 0 20px; color: ${colors.textSecondary}; font-size: ${fontSize.md}; line-height: 1.5;`,
  
  paragraphSmall: `margin: 0 0 20px; color: ${colors.textSecondary}; font-size: ${fontSize.sm}; line-height: 1.5;`,
  
  paragraphMuted: `margin: 20px 0 0; color: ${colors.textMuted}; font-size: ${fontSize.sm}; line-height: 1.5;`,
  
  link: `color: ${colors.textLink}; text-decoration: none;`,
  
  linkUrl: `color: ${colors.textLink}; font-size: ${fontSize.sm}; word-break: break-all;`,
  
  buttonPrimary: `display: inline-block; padding: 14px 32px; background-color: ${colors.primary}; color: ${colors.bgWhite}; text-decoration: none; border-radius: ${borderRadius.md}; font-size: ${fontSize.md}; font-weight: ${fontWeight.semibold};`,
  
  buttonGradient: `display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientEnd} 100%); color: white; text-decoration: none; border-radius: ${borderRadius.lg}; font-size: 15px; font-weight: ${fontWeight.semibold}; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);`,
  
  buttonSuccess: `display: inline-block; padding: 14px 32px; background-color: ${colors.success}; color: ${colors.bgWhite}; text-decoration: none; border-radius: ${borderRadius.md}; font-size: ${fontSize.md}; font-weight: ${fontWeight.semibold};`,
  
  footerText: `margin: 0; color: ${colors.textMuted}; font-size: ${fontSize.xs}; line-height: 1.5; text-align: center;`,
  
  infoBox: `background-color: ${colors.bgLighter}; border-radius: ${borderRadius.lg}; padding: 20px; margin: 20px 0;`,
  
  successBadge: `display: inline-block; padding: 4px 12px; background-color: ${colors.successBg}; color: ${colors.success}; border-radius: 20px; font-size: ${fontSize.sm}; font-weight: ${fontWeight.medium};`,
  
  warningBadge: `display: inline-block; padding: 4px 12px; background-color: ${colors.warningBg}; color: ${colors.warning}; border-radius: 20px; font-size: ${fontSize.sm}; font-weight: ${fontWeight.medium};`,
  
  errorBadge: `display: inline-block; padding: 4px 12px; background-color: ${colors.errorBg}; color: ${colors.error}; border-radius: 20px; font-size: ${fontSize.sm}; font-weight: ${fontWeight.medium};`,
  
  tableHeader: `padding: 12px 16px; background-color: ${colors.bgLighter}; color: ${colors.textMuted}; font-size: ${fontSize.xs}; font-weight: ${fontWeight.semibold}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid ${colors.border};`,
  
  tableCell: `padding: 12px 16px; border-bottom: 1px solid ${colors.borderLight}; color: ${colors.textPrimary}; font-size: ${fontSize.sm};`,
  
  detailRow: `padding: 8px 0; color: ${colors.textMuted}; font-size: ${fontSize.sm};`,
  
  detailValue: `padding: 8px 0; color: ${colors.textPrimary}; font-size: ${fontSize.sm};`,
} as const

// Currency symbols by code
export const currencySymbols: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  CAD: 'C$',
  AUD: 'A$',
} as const

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currency: string): string {
  return currencySymbols[currency.toUpperCase()] || currency
}
