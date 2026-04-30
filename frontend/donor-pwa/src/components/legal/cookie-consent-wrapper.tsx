/**
 * CookieConsentWrapper component
 * Shows cookie consent banner on first visit
 */
import { useEffect, useState } from 'react'
import { hasSetCookiePreferences } from '@/utils/cookie-manager'
import { CookieConsentBanner } from './cookie-consent-banner'

export function CookieConsentWrapper() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already set preferences
    const hasPreferences = hasSetCookiePreferences()

    // Show banner if no preferences are set
    if (!hasPreferences) {
      // Delay slightly to ensure page is loaded
      const timer = setTimeout(() => {
        setShowBanner(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [])

  return <CookieConsentBanner open={showBanner} onOpenChange={setShowBanner} />
}
