import { hashPassword } from "./auth"
import { randomInt } from "crypto"

/**
 * Cryptographically secure random integer in range [min, max)
 */
function secureRandomInt(min: number, max: number): number {
  return randomInt(min, max)
}

/**
 * Cryptographically secure shuffle using Fisher-Yates algorithm
 */
function secureShuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Generate a cryptographically secure random password
 * Format: 12 characters with uppercase, lowercase, numbers, and special characters
 */
export function generatePassword(): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lowercase = "abcdefghijklmnopqrstuvwxyz"
  const numbers = "0123456789"
  const special = "!@#$%&*"
  
  const allChars = uppercase + lowercase + numbers + special
  
  // Ensure at least one of each type using cryptographically secure random
  let passwordChars: string[] = []
  passwordChars.push(uppercase[secureRandomInt(0, uppercase.length)])
  passwordChars.push(lowercase[secureRandomInt(0, lowercase.length)])
  passwordChars.push(numbers[secureRandomInt(0, numbers.length)])
  passwordChars.push(special[secureRandomInt(0, special.length)])
  
  // Fill the rest randomly
  for (let i = 4; i < 12; i++) {
    passwordChars.push(allChars[secureRandomInt(0, allChars.length)])
  }
  
  // Cryptographically secure shuffle
  return secureShuffleArray(passwordChars).join("")
}

/**
 * Generate employee credentials (temporary password and hashed password)
 */
export async function generateEmployeeCredentials(): Promise<{ password: string; hashedPassword: string }> {
  const password = generatePassword()
  const hashedPassword = await hashPassword(password)
  
  return {
    password, // Plain text password to show to admin
    hashedPassword, // Hashed password to store in database
  }
}

