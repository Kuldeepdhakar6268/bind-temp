const RESERVED_EMAILS = new Set([
  "contact@bindme.co.uk",
])

export function normalizeEmail(email: string | undefined | null): string {
  if (!email) return ""
  return email.trim().toLowerCase()
}

export function isReservedEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email)
  return normalized !== "" && RESERVED_EMAILS.has(normalized)
}

export function getReservedEmailMessage(label: string): string {
  return `${label} cannot use a reserved address (${Array.from(RESERVED_EMAILS).join(", ")}).`
}
