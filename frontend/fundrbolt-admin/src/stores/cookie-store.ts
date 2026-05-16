/**
 * Cookie Consent Store
 * Zustand store for managing cookie consent state
 */
import { cookieService } from '@/services/cookie-service'
import type {
  CookieConsentPreferences,
  CookieConsentStatusResponse,
} from '@/types/cookie'
import {
  clearSessionId,
  getCookiePreferences,
  getSessionId,
  hasSetCookiePreferences,
  saveCookiePreferences,
} from '@/utils/cookie-manager'
import { create } from 'zustand'

interface CookieConsentState {
  preferences: CookieConsentPreferences
  hasConsent: boolean
  isLoading: boolean
  error: string | null
  sessionId: string | null

  // Actions
  fetchConsent: () => Promise<void>
  setConsent: (
    preferences: Omit<CookieConsentPreferences, 'essential'>
  ) => Promise<void>
  updateConsent: (
    preferences: Omit<CookieConsentPreferences, 'essential'>
  ) => Promise<void>
  revokeConsent: () => Promise<void>
  acceptAll: () => Promise<void>
  rejectAll: () => Promise<void>
  reset: () => void
}

const defaultPreferences: CookieConsentPreferences = {
  essential: true,
  analytics: false,
  marketing: false,
}

export const useCookieStore = create<CookieConsentState>((set, get) => ({
  preferences: defaultPreferences,
  hasConsent: hasSetCookiePreferences(),
  isLoading: false,
  error: null,
  sessionId: null,

  fetchConsent: async () => {
    set({ isLoading: true, error: null })

    try {
      // Check localStorage first
      const stored = getCookiePreferences()
      if (stored) {
        set({ preferences: stored, hasConsent: true, isLoading: false })
        return
      }

      // If not in localStorage, fetch from backend
      const sessionId = getSessionId()
      set({ sessionId })

      const response: CookieConsentStatusResponse =
        await cookieService.getConsent(sessionId)

      const preferences: CookieConsentPreferences = {
        essential: response.essential,
        analytics: response.analytics,
        marketing: response.marketing,
      }

      set({
        preferences,
        hasConsent: response.has_consent,
        isLoading: false,
      })

      // Save to localStorage
      if (response.has_consent) {
        saveCookiePreferences(preferences)
      }
    } catch (_error) {
      set({
        error: 'Failed to fetch cookie consent',
        isLoading: false,
      })
    }
  },

  setConsent: async (prefs: Omit<CookieConsentPreferences, 'essential'>) => {
    set({ isLoading: true, error: null })

    const preferences: CookieConsentPreferences = {
      essential: true,
      ...prefs,
    }

    // Persist locally first so the banner doesn't reappear even if the
    // backend call fails (e.g. network error, unauthenticated session).
    saveCookiePreferences(preferences)
    set({ preferences, hasConsent: true })

    try {
      const sessionId = get().sessionId || getSessionId()
      set({ sessionId })

      await cookieService.setConsent(
        { analytics: prefs.analytics, marketing: prefs.marketing },
        sessionId
      )

      set({ isLoading: false })
    } catch (_error) {
      // Backend sync failed but local preference is already saved.
      set({ isLoading: false })
    }
  },

  updateConsent: async (prefs: Omit<CookieConsentPreferences, 'essential'>) => {
    set({ isLoading: true, error: null })

    const preferences: CookieConsentPreferences = {
      essential: true,
      ...prefs,
    }

    // Persist locally first.
    saveCookiePreferences(preferences)
    set({ preferences, hasConsent: true })

    try {
      const sessionId = get().sessionId || getSessionId()

      await cookieService.updateConsent(
        { analytics: prefs.analytics, marketing: prefs.marketing },
        sessionId
      )

      set({ isLoading: false })
    } catch (_error) {
      set({ isLoading: false })
    }
  },

  revokeConsent: async () => {
    set({ isLoading: true, error: null })

    try {
      const sessionId = get().sessionId

      await cookieService.revokeConsent(sessionId || undefined)

      set({
        preferences: defaultPreferences,
        hasConsent: false,
        isLoading: false,
      })

      // Clear session ID after revoke
      if (sessionId) {
        clearSessionId()
        set({ sessionId: null })
      }
    } catch (_error) {
      set({
        error: 'Failed to revoke cookie consent',
        isLoading: false,
      })
    }
  },

  acceptAll: async () => {
    await get().setConsent({ analytics: true, marketing: true })
  },

  rejectAll: async () => {
    await get().setConsent({ analytics: false, marketing: false })
  },

  reset: () => {
    set({
      preferences: defaultPreferences,
      hasConsent: false,
      isLoading: false,
      error: null,
      sessionId: null,
    })
  },
}))
