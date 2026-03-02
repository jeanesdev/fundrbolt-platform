/**
 * useCookieConsent hook
 * Hook for managing cookie consent in components
 */

import { useCookieStore } from '@/stores/cookie-store'
import { useEffect } from 'react'

export function useCookieConsent() {
  const {
    preferences,
    hasConsent,
    isLoading,
    error,
    fetchConsent,
    setConsent,
    updateConsent,
    acceptAll,
    rejectAll,
  } = useCookieStore()

  // Auto-fetch consent on mount
  useEffect(() => {
    fetchConsent()
  }, [fetchConsent])

  return {
    preferences,
    hasConsent,
    isLoading,
    error,
    setConsent,
    updateConsent,
    acceptAll,
    rejectAll,
  }
}
