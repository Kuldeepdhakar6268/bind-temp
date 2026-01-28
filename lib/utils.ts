import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type StatusTheme = {
  label: string
  badgeClass: string
}

const statusThemes: Record<string, StatusTheme> = {
  completed: { label: "Completed", badgeClass: "bg-chart-2 text-white" },
  "in-progress": { label: "In Progress", badgeClass: "bg-chart-1 text-white" },
  scheduled: { label: "Scheduled", badgeClass: "bg-chart-4 text-white" },
  pending: { label: "Pending", badgeClass: "bg-muted text-muted-foreground" },
  draft: { label: "Draft", badgeClass: "bg-muted text-muted-foreground" },
  overdue: { label: "Overdue", badgeClass: "bg-destructive text-white" },
  paid: { label: "Paid", badgeClass: "bg-chart-2 text-white" },
  active: { label: "Active", badgeClass: "bg-chart-2 text-white" },
  paused: { label: "Paused", badgeClass: "bg-muted text-muted-foreground" },
  "at-risk": { label: "At Risk", badgeClass: "bg-amber-500 text-white" },
  expiring: { label: "Expiring", badgeClass: "bg-orange-500 text-white" },
  inactive: { label: "Inactive", badgeClass: "bg-muted text-muted-foreground" },
}

export function getStatusTheme(status?: string): StatusTheme {
  if (!status) return { label: "Unknown", badgeClass: "bg-muted text-muted-foreground" }
  return statusThemes[status] ?? { label: status.replace("-", " "), badgeClass: "bg-muted text-muted-foreground" }
}

export function formatCurrency(value: number, currency = "GBP", locale = "en-GB") {
  if (Number.isNaN(value)) return "-"
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Generate a secure random token for feedback links, quote access, etc.
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}

/**
 * Generate a feedback request URL for a job
 */
export function generateFeedbackUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moppissimo.space'
  return `${baseUrl}/feedback/${token}`
}
