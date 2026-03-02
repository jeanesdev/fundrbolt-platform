import { type AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculates exponential backoff delay with jitter
 *
 * @param attempt - Current retry attempt (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: Required<RetryConfig>
): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (±10%) to prevent thundering herd
  const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

/**
 * Determines if an error is retryable
 *
 * @param error - The error to check
 * @param config - Retry configuration
 * @returns True if the error should be retried
 */
export function isRetryableError(
  error: unknown,
  config: Required<RetryConfig>
): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const axiosError = error as AxiosError;

  // Network errors (timeout, no connection, etc)
  if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ENOTFOUND') {
    return true;
  }

  // Check status codes
  if (axiosError.response?.status) {
    // Don't retry 401 (auth) or 409 (conflict) - already handled by interceptors
    if ([401, 409].includes(axiosError.response.status)) {
      return false;
    }

    return config.retryableStatusCodes.includes(axiosError.response.status);
  }

  // Network timeout
  if (axiosError.code === 'ECONNREFUSED') {
    return true;
  }

  return false;
}

/**
 * Sleeps for specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @returns Promise with the result of the function
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => apiClient.get('/tickets'),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!isRetryableError(error, mergedConfig)) {
        throw error;
      }

      // Don't sleep after last failed attempt
      if (attempt < mergedConfig.maxRetries) {
        const delay = calculateBackoffDelay(attempt, mergedConfig);
        // eslint-disable-next-line no-console
        console.warn(
          `Retrying after ${delay}ms (attempt ${attempt + 1}/${mergedConfig.maxRetries})`,
          error
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
