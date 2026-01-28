export type CompanyNotificationKey =
  | "jobUpdates"
  | "employeeUpdates"
  | "bookingUpdates"
  | "quoteUpdates"
  | "financeUpdates"

export type CompanyNotificationSettings = Record<CompanyNotificationKey, boolean>

export const defaultCompanyNotificationSettings: CompanyNotificationSettings = {
  jobUpdates: true,
  employeeUpdates: true,
  bookingUpdates: true,
  quoteUpdates: true,
  financeUpdates: true,
}

function coerceBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  return fallback
}

export function normalizeCompanyNotificationSettings(
  raw: unknown
): CompanyNotificationSettings {
  let parsed: any = raw

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { ...defaultCompanyNotificationSettings }
  }

  return {
    jobUpdates: coerceBoolean(parsed.jobUpdates, defaultCompanyNotificationSettings.jobUpdates),
    employeeUpdates: coerceBoolean(parsed.employeeUpdates, defaultCompanyNotificationSettings.employeeUpdates),
    bookingUpdates: coerceBoolean(parsed.bookingUpdates, defaultCompanyNotificationSettings.bookingUpdates),
    quoteUpdates: coerceBoolean(parsed.quoteUpdates, defaultCompanyNotificationSettings.quoteUpdates),
    financeUpdates: coerceBoolean(parsed.financeUpdates, defaultCompanyNotificationSettings.financeUpdates),
  }
}

export function isCompanyNotificationEnabled(
  raw: unknown,
  key: CompanyNotificationKey
): boolean {
  const settings = normalizeCompanyNotificationSettings(raw)
  return settings[key]
}

