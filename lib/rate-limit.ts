/**
 * Simple in-memory rate limiter
 * 
 * ⚠️ IMPORTANT: This in-memory implementation has limitations in serverless environments:
 * - Rate limits are NOT shared across serverless function instances
 * - Limits reset when the function cold starts
 * 
 * For production at scale, consider using Redis-based rate limiting:
 * - @upstash/ratelimit with Upstash Redis
 * - Vercel KV (Redis-based)
 * 
 * Current implementation still provides protection for:
 * - Single-instance deployments
 * - Basic abuse prevention
 * - Development/testing environments
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimits = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetAt) {
      rateLimits.delete(key)
    }
  }
}, 60000) // Clean every minute

export interface RateLimitConfig {
  /** Maximum requests allowed */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 5, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimits.get(identifier)

  // No existing entry or expired
  if (!entry || now > entry.resetAt) {
    rateLimits.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment count
  entry.count++
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get IP address from request
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }
  return "unknown"
}

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Auth endpoints - stricter limits
  signin: { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  signup: { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  forgotPassword: { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  resetPassword: { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  verifyEmail: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  resendVerification: { maxRequests: 3, windowMs: 300000 }, // 3 per 5 minutes
  
  // General API endpoints
  api: { maxRequests: 60, windowMs: 60000 }, // 60 per minute
}
