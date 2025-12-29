/**
 * Cookie Manager Utility
 * Handles localStorage operations and session ID generation for cookie consent
 */

import type { CookieConsentPreferences } from '@/types/cookie'

const STORAGE_KEY = 'cookie-consent'
const SESSION_ID_KEY = 'cookie-session-id'

/**
 * Generate a unique session ID for anonymous users
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Get or create session ID from localStorage
 */
export function getSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = generateSessionId()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

/**
 * Clear session ID (useful when user logs in - consent transfers to user account)
 */
export function clearSessionId(): void {
  localStorage.removeItem(SESSION_ID_KEY)
}

/**
 * Save cookie preferences to localStorage
 */
export function saveCookiePreferences(preferences: CookieConsentPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

/**
 * Get cookie preferences from localStorage
 */
export function getCookiePreferences(): CookieConsentPreferences | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null

  try {
    return JSON.parse(stored) as CookieConsentPreferences
  } catch {
    return null
  }
}

/**
 * Clear cookie preferences from localStorage
 */
export function clearCookiePreferences(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Check if user has already set cookie preferences
 */
export function hasSetCookiePreferences(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

/**
 * Set a cookie with expiration
 */
export function setCookie(name: string, value: string, days: number): void {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
  }
  return null
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}
