/**
 * Cookie consent service
 * API client for managing cookie consent preferences
 */

import apiClient from '@/lib/axios'
import type {
  CookieConsentRequest,
  CookieConsentResponse,
  CookieConsentStatusResponse,
  CookieConsentUpdateRequest,
} from '@/types/cookie'

export const cookieService = {
  /**
   * Get current cookie consent status
   * Works for both authenticated and anonymous users
   * @param sessionId - Optional session ID for anonymous users
   */
  async getConsent(sessionId?: string): Promise<CookieConsentStatusResponse> {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {}
    const response = await apiClient.get<CookieConsentStatusResponse>(
      '/cookies/consent',
      { headers }
    )
    return response.data
  },

  /**
   * Set initial cookie consent preferences
   * @param preferences - Cookie preferences to set
   * @param sessionId - Optional session ID for anonymous users
   */
  async setConsent(
    preferences: CookieConsentRequest,
    sessionId?: string
  ): Promise<CookieConsentResponse> {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {}
    const response = await apiClient.post<CookieConsentResponse>(
      '/cookies/consent',
      preferences,
      { headers }
    )
    return response.data
  },

  /**
   * Update existing cookie consent preferences
   * @param preferences - Updated preferences
   * @param sessionId - Optional session ID for anonymous users
   */
  async updateConsent(
    preferences: CookieConsentUpdateRequest,
    sessionId?: string
  ): Promise<CookieConsentResponse> {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {}
    const response = await apiClient.put<CookieConsentResponse>(
      '/cookies/consent',
      preferences,
      { headers }
    )
    return response.data
  },

  /**
   * Revoke cookie consent (default to reject all except essential)
   * @param sessionId - Optional session ID for anonymous users
   */
  async revokeConsent(sessionId?: string): Promise<void> {
    const headers = sessionId ? { 'X-Session-ID': sessionId } : {}
    await apiClient.delete('/cookies/consent', { headers })
  },
}
