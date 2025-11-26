/**
 * useConsentCheck hook
 * Hook for checking user consent status and managing consent
 */

import { consentService } from '@/services/consent-service'
import type { ConsentStatusResponse } from '@/types/consent'
import { useEffect, useState } from 'react'

export function useConsentCheck() {
  const [consentStatus, setConsentStatus] = useState<ConsentStatusResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkConsentStatus = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const status = await consentService.getConsentStatus()
      setConsentStatus(status)
      return status
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check consent status:', error)
      setError('Failed to check consent status')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-check consent status on mount
  useEffect(() => {
    checkConsentStatus().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to check consent status:', err)
    })
  }, [])

  return {
    consentStatus,
    hasActiveConsent: consentStatus?.has_active_consent ?? false,
    requiresUpdate: consentStatus?.requires_update ?? false,
    isLoading,
    error,
    refetch: checkConsentStatus,
  }
}
