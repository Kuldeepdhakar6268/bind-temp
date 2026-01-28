/**
 * UK Phone Number Validation and Formatting
 * Supports UK mobile (07xxx) and landline formats
 */

// UK Mobile: 07xxx xxxxxx (11 digits)
const UK_MOBILE_REGEX = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/

// UK Landline: 01xxx, 02xxx, 03xxx (10-11 digits)
const UK_LANDLINE_REGEX = /^(\+44\s?[1-3]|0[1-3])\d{1,4}\s?\d{3,4}\s?\d{3,4}$/

// Combined UK phone regex
const UK_PHONE_REGEX = /^(\+44\s?7\d{3}|\(?07\d{3}\)?|\+44\s?[1-3]|0[1-3])\d{1,4}\s?\d{3,4}\s?\d{3,4}$/

/**
 * Validate if a phone number is a valid UK mobile number
 */
export function isValidUKMobile(phone: string): boolean {
  if (!phone) return false
  const cleaned = phone.replace(/\s/g, "")
  
  // Check for 07xxx xxxxxx format
  if (/^07\d{9}$/.test(cleaned)) return true
  
  // Check for +447xxx xxxxxx format
  if (/^\+447\d{9}$/.test(cleaned)) return true
  
  return false
}

/**
 * Validate if a phone number is a valid UK landline number
 */
export function isValidUKLandline(phone: string): boolean {
  if (!phone) return false
  const cleaned = phone.replace(/\s/g, "")
  
  // UK landline formats:
  // 020 xxxx xxxx (London - 10 digits)
  // 011x xxx xxxx (11 digits)
  // 01xxx xxxxxx (11 digits)
  // 01xx xxx xxxx (11 digits)
  
  // Check for 0[1-3] prefix
  if (!/^0[1-3]/.test(cleaned)) return false
  
  // Check length (10-11 digits)
  if (cleaned.length < 10 || cleaned.length > 11) return false
  
  // Check for +44 format
  if (/^\+44[1-3]\d{8,9}$/.test(cleaned)) return true
  
  return true
}

/**
 * Validate if a phone number is a valid UK phone number (mobile or landline)
 */
export function isValidUKPhone(phone: string): boolean {
  if (!phone) return false
  return isValidUKMobile(phone) || isValidUKLandline(phone)
}

/**
 * Format a UK phone number to a standard format
 */
export function formatUKPhone(phone: string): string {
  if (!phone) return ""
  
  // Remove all spaces and special characters except +
  let cleaned = phone.replace(/[^\d+]/g, "")
  
  // Handle +44 format
  if (cleaned.startsWith("+44")) {
    cleaned = "0" + cleaned.substring(3)
  } else if (cleaned.startsWith("44")) {
    cleaned = "0" + cleaned.substring(2)
  }
  
  // Format mobile: 07xxx xxxxxx
  if (cleaned.startsWith("07") && cleaned.length === 11) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`
  }
  
  // Format London landline: 020 xxxx xxxx
  if (cleaned.startsWith("020") && cleaned.length === 10) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 7)} ${cleaned.substring(7)}`
  }
  
  // Format other landlines: 01xxx xxxxxx
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`
  }
  
  // Format 3-digit area code landlines: 011x xxx xxxx
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`
  }
  
  // Return as-is if format not recognized
  return phone
}

/**
 * Get a user-friendly error message for invalid UK phone numbers
 */
export function getUKPhoneErrorMessage(phone: string): string {
  if (!phone) return "Phone number is required"
  
  const cleaned = phone.replace(/\s/g, "")
  
  if (cleaned.length < 10) {
    return "UK phone numbers must be at least 10 digits"
  }
  
  if (cleaned.length > 11 && !cleaned.startsWith("+44")) {
    return "UK phone numbers must be 10-11 digits"
  }
  
  if (!cleaned.startsWith("0") && !cleaned.startsWith("+44")) {
    return "UK phone numbers must start with 0 or +44"
  }
  
  if (cleaned.startsWith("07")) {
    return "Invalid UK mobile number format. Expected: 07xxx xxxxxx"
  }
  
  if (cleaned.startsWith("0")) {
    return "Invalid UK landline number format. Expected: 01xxx xxxxxx or 020 xxxx xxxx"
  }
  
  return "Invalid UK phone number format"
}

/**
 * Validate and format a UK phone number
 * Returns formatted number if valid, or null with error message if invalid
 */
export function validateAndFormatUKPhone(phone: string): { 
  valid: boolean
  formatted: string | null
  error: string | null
} {
  if (!phone) {
    return { valid: false, formatted: null, error: "Phone number is required" }
  }
  
  if (!isValidUKPhone(phone)) {
    return { 
      valid: false, 
      formatted: null, 
      error: getUKPhoneErrorMessage(phone) 
    }
  }
  
  return { 
    valid: true, 
    formatted: formatUKPhone(phone), 
    error: null 
  }
}

