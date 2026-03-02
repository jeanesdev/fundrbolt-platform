/**
 * TypeScript types for cookie consent management
 */

export type CookieCategory = 'essential' | 'analytics' | 'marketing'

export interface CookieConsentPreferences {
  essential: boolean // Always true, not configurable
  analytics: boolean
  marketing: boolean
}

export interface CookieConsentRequest {
  analytics: boolean
  marketing: boolean
}

export interface CookieConsentUpdateRequest {
  analytics: boolean
  marketing: boolean
}

export interface CookieConsentResponse {
  id: string
  user_id: string | null
  session_id: string | null
  essential: boolean
  analytics: boolean
  marketing: boolean
  created_at: string
  updated_at: string
}

export interface CookieConsentStatusResponse {
  essential: boolean
  analytics: boolean
  marketing: boolean
  has_consent: boolean // True if user has set preferences
}

export interface CookieCategoryInfo {
  name: string
  description: string
  required: boolean
  enabled: boolean
}
