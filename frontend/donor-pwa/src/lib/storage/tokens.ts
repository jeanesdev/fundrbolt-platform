/**
 * Token Storage Utilities
 *
 * Manages refresh token persistence in localStorage.
 * Access tokens are stored in memory only (Zustand store) for security.
 *
 * Storage strategy:
 * - Refresh token: localStorage (7-day expiry, cross-tab persistence)
 * - Access token: Zustand store (15-minute expiry, memory only)
 * - Token expiry: localStorage (for session management)
 */

const REFRESH_TOKEN_KEY = 'fundrbolt_refresh_token'
const TOKEN_EXPIRY_KEY = 'fundrbolt_token_expiry'

/**
 * Saves refresh token to localStorage with expiry timestamp.
 *
 * @param token - Refresh token JWT
 * @param expiryTimestamp - Unix timestamp (ms) when session expires
 */
export function saveRefreshToken(token: string, expiryTimestamp: number): void {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTimestamp.toString())
  } catch (error) {
    console.error('Failed to save refresh token:', error)
  }
}

/**
 * Retrieves refresh token from localStorage.
 *
 * @returns Refresh token or null if not found/expired
 */
export function getRefreshToken(): string | null {
  try {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY)
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)

    if (!token || !expiryStr) {
      return null
    }

    // Check if token is expired
    const expiry = parseInt(expiryStr, 10)
    if (Date.now() >= expiry) {
      // Token expired, clear storage
      clearRefreshToken()
      return null
    }

    return token
  } catch (error) {
    console.error('Failed to get refresh token:', error)
    return null
  }
}

/**
 * Gets token expiry timestamp from localStorage.
 *
 * @returns Unix timestamp (ms) or null if not found
 */
export function getTokenExpiry(): number | null {
  try {
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
    return expiryStr ? parseInt(expiryStr, 10) : null
  } catch (error) {
    console.error('Failed to get token expiry:', error)
    return null
  }
}

/**
 * Clears refresh token and expiry from localStorage.
 */
export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  } catch (error) {
    console.error('Failed to clear refresh token:', error)
  }
}

/**
 * Checks if refresh token exists and is valid.
 *
 * @returns True if valid token exists, false otherwise
 */
export function hasValidRefreshToken(): boolean {
  return getRefreshToken() !== null
}

/**
 * Gets remaining time until session expires (in milliseconds).
 *
 * @returns Remaining time in ms, or 0 if expired/not found
 */
export function getRemainingSessionTime(): number {
  const expiry = getTokenExpiry()
  if (!expiry) return 0

  const remaining = expiry - Date.now()
  return Math.max(0, remaining)
}

/**
 * Checks if session will expire within specified time (in milliseconds).
 *
 * @param timeMs - Time threshold in milliseconds (e.g., 2 minutes = 120000)
 * @returns True if expiring soon, false otherwise
 */
export function isSessionExpiringSoon(timeMs: number): boolean {
  const remaining = getRemainingSessionTime()
  return remaining > 0 && remaining <= timeMs
}
