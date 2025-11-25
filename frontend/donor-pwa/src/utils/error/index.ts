/**
 * Error utility functions
 */

/**
 * Extract error message from various error types
 * Handles axios errors, standard errors, and unknown types
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An error occurred'): string {
  if (typeof error === 'string') {
    return error;
  }

  // Handle null/undefined
  if (!error) {
    return fallbackMessage;
  }

  // Handle axios-style errors with nested response.data.error.message
  const axiosError = error as {
    response?: { data?: { error?: { message?: string } } };
    message?: string;
  };

  if (axiosError.response?.data?.error?.message) {
    return axiosError.response.data.error.message;
  }

  // Handle standard Error objects
  if (axiosError.message) {
    return axiosError.message;
  }

  return fallbackMessage;
}
