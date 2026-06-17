/**
 * CookieConsentWrapper component
 * Shows cookie consent banner on first visit
 */
import { useEffect, useState } from 'react'
import { hasSetCookiePreferences } from '@/utils/cookie-manager'
import { CookieConsentBanner } from './cookie-consent-banner'

interface CookieConsentWrapperProps {
  /** Called whenever the consent dialog opens or closes */
  onOpenChange?: (open: boolean) => void
}

export function CookieConsentWrapper({
  onOpenChange,
}: CookieConsentWrapperProps = {}) {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already set preferences
    const hasPreferences = hasSetCookiePreferences()

    // Show banner if no preferences are set
    if (!hasPreferences) {
      // Delay slightly to ensure page is loaded
      const timer = setTimeout(() => {
        setShowBanner(true)
        onOpenChange?.(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenChange = (open: boolean) => {
    setShowBanner(open)
    onOpenChange?.(open)
  }

  return (
    <CookieConsentBanner open={showBanner} onOpenChange={handleOpenChange} />
  )
}
