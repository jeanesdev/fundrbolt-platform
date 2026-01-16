/**
 * Utility functions for handling API errors consistently across the application
 */

/** Type for API error responses */
interface ApiErrorResponse {
  response?: {
    status?: number
    data?: {
      detail?: string | { code?: string; message?: string } | Array<{ loc: string[]; msg: string; type: string }>
      message?: string
      error?: {
        message?: string
      }
    }
  }
  message?: string
}

/**
 * Extract a user-friendly error message from an API error response
 *
 * Handles various error response formats:
 * - Structured errors with code/message (e.g., consent errors): {detail: {code: "...", message: "..."}}
 * - Simple string errors: {detail: "Error message"}
 * - Plain message: {message: "Error message"}
 * - Fallback to default message
 *
 * @param error - The error object from the API request
 * @param defaultMessage - Default message to show if no error message can be extracted
 * @returns A user-friendly error message string
 *
 * @example
 * ```tsx
 * try {
 *   await api.someRequest()
 * } catch (error) {
 *   toast.error(getErrorMessage(error, 'Operation failed'))
 * }
 * ```
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (!error) {
    return defaultMessage
  }

  const apiError = error as ApiErrorResponse

  // Check for response data
  const data = apiError.response?.data

  if (!data) {
    return apiError.message || defaultMessage
  }

  // Handle Pydantic validation errors (array format)
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    const messages = data.detail
      .map((err: { msg?: string; message?: string }) => err.msg || err.message)
      .filter((msg: unknown): msg is string => typeof msg === 'string');

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  // Handle structured error with code/message (e.g., consent errors, validation errors)
  if (typeof data.detail === 'object' && data.detail !== null && !Array.isArray(data.detail)) {
    return data.detail.message || data.detail.code || defaultMessage
  }

  // Handle simple string detail
  if (typeof data.detail === 'string') {
    return data.detail
  }

  // Handle plain message field
  if (typeof data.message === 'string') {
    return data.message
  }

  // Handle nested error object (some APIs use this format)
  if (data.error?.message) {
    return data.error.message
  }

  // Fallback to error message or default
  return apiError.message || defaultMessage
}

/**
 * Check if an error is a specific HTTP status code
 *
 * @param error - The error object from the API request
 * @param statusCode - The HTTP status code to check for
 * @returns True if the error matches the status code
 *
 * @example
 * ```tsx
 * if (isErrorStatus(error, 409)) {
 *   // Handle conflict error
 * }
 * ```
 */
export function isErrorStatus(error: unknown, statusCode: number): boolean {
  const apiError = error as ApiErrorResponse
  return apiError?.response?.status === statusCode
}

/**
 * Check if an error is a consent-related error
 *
 * @param error - The error object from the API request
 * @returns True if the error is consent-related
 */
export function isConsentError(error: unknown): boolean {
  const apiError = error as ApiErrorResponse
  const data = apiError?.response?.data
  return (
    isErrorStatus(error, 409) &&
    typeof data?.detail === 'object' &&
    data.detail !== null &&
    !Array.isArray(data.detail) &&
    'code' in data.detail &&
    (data.detail.code === 'CONSENT_REQUIRED' || data.detail.code === 'CONSENT_OUTDATED')
  )
}

/**
 * Check if an error is a validation error
 *
 * @param error - The error object from the API request
 * @returns True if the error is a validation error (422)
 */
export function isValidationError(error: unknown): boolean {
  return isErrorStatus(error, 422)
}
