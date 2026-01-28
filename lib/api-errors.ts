import { NextResponse } from "next/server"

/**
 * Clean error message by removing SQL details and technical information
 */
export function cleanErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An unexpected error occurred"
  }

  const message = error.message

  // Check for common database constraint errors
  if (message.includes("unique constraint") || message.includes("duplicate key")) {
    if (message.includes("email")) {
      return "This email address is already in use for this company"
    }
    if (message.includes("phone")) {
      return "This phone number is already in use for this company"
    }
    return "A record with this information already exists"
  }

  if (message.includes("foreign key constraint")) {
    return "Cannot complete this action due to related records"
  }

  if (message.includes("not null constraint")) {
    return "Required information is missing"
  }

  if (message.includes("check constraint")) {
    return "Invalid data provided"
  }

  // Check for validation errors
  if (message.includes("invalid") || message.includes("validation")) {
    return "Invalid data provided"
  }

  // Check for authentication errors
  if (message.includes("unauthorized") || message.includes("authentication")) {
    return "Authentication required"
  }

  if (message.includes("forbidden") || message.includes("permission")) {
    return "You don't have permission to perform this action"
  }

  // Check for not found errors
  if (message.includes("not found")) {
    return "The requested resource was not found"
  }

  // Default to a generic message
  return "An error occurred while processing your request"
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = "An error occurred",
  status: number = 500
): NextResponse {
  const isDevelopment = process.env.NODE_ENV === "development"

  console.error("API Error:", error)

  // In development, show FULL error details - no hiding!
  if (isDevelopment && error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message,
        details: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        },
      },
      { status }
    )
  }

  // In production, show clean error messages only
  return NextResponse.json(
    {
      error: cleanErrorMessage(error) || defaultMessage,
    },
    { status }
  )
}

/**
 * Create a validation error response
 */
export function createValidationError(message: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 400 }
  )
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedError(message: string = "Unauthorized"): NextResponse {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 401 }
  )
}

/**
 * Create a forbidden error response
 */
export function createForbiddenError(message: string = "Forbidden"): NextResponse {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 403 }
  )
}

/**
 * Create a not found error response
 */
export function createNotFoundError(message: string = "Not found"): NextResponse {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 404 }
  )
}

/**
 * Create a conflict error response
 */
export function createConflictError(message: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
    },
    { status: 409 }
  )
}

