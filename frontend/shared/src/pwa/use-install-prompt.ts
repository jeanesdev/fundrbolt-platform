import { useCallback, useEffect, useRef, useState } from 'react'

import {
  INSTALL_PROMPT_COOLDOWN_MS,
  getInstallDismissedKey,
} from './constants'

/**
 * Augment the global Window interface to include the `beforeinstallprompt` event.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export interface UseInstallPromptReturn {
  /** Whether the install banner should be visible */
  canShow: boolean
  /** Whether we're on iOS (show manual instructions instead of native prompt) */
  isIOS: boolean
  /** Whether the app is already installed in standalone mode */
  isInstalled: boolean
  /** Trigger the native install dialog (no-op on iOS) */
  promptInstall: () => Promise<void>
  /** Dismiss the banner and start the 7-day cooldown */
  dismiss: () => void
}

/**
 * Hook to manage the PWA install prompt lifecycle.
 *
 * @param appId - Unique key for localStorage cooldown tracking (e.g., "donor" or "admin")
 */
export function useInstallPrompt(appId: string): UseInstallPromptReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [promptAvailable, setPromptAvailable] = useState(false)

  // Detect iOS Safari
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream

  // Detect standalone mode (already installed)
  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
      true)

  // Check cooldown
  const isDismissedRecently = useCallback((): boolean => {
    try {
      const key = getInstallDismissedKey(appId)
      const dismissedAt = localStorage.getItem(key)
      if (!dismissedAt) return false
      const elapsed = Date.now() - parseInt(dismissedAt, 10)
      return elapsed < INSTALL_PROMPT_COOLDOWN_MS
    } catch {
      return false
    }
  }, [appId])

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setPromptAvailable(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const canShow =
    !isInstalled &&
    !isDismissedRecently() &&
    (promptAvailable || isIOS)

  const promptInstall = useCallback(async () => {
    const deferredPrompt = deferredPromptRef.current
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      deferredPromptRef.current = null
      setPromptAvailable(false)
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      const key = getInstallDismissedKey(appId)
      localStorage.setItem(key, Date.now().toString())
    } catch {
      // localStorage may be unavailable
    }
    deferredPromptRef.current = null
    setPromptAvailable(false)
  }, [appId])

  return {
    canShow,
    isIOS,
    isInstalled,
    promptInstall,
    dismiss,
  }
}
