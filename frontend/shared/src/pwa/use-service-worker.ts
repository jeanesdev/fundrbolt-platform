import { useCallback, useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

import {
  AUTO_UPDATE_TIMEOUT_MS,
  SW_UPDATE_DETECTED_KEY,
  UPDATE_CHECK_INTERVAL_MS,
} from './constants'

export interface UseServiceWorkerReturn {
  /** Whether the app shell has been fully cached and is ready for offline use */
  offlineReady: boolean
  /** Whether a new version of the app is available and waiting to be activated */
  needRefresh: boolean
  /** Activate the waiting service worker and optionally reload the page */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  /** Dismiss the "offline ready" notification */
  dismissOfflineReady: () => void
  /** Dismiss the "update available" notification (24h auto-update timer continues) */
  dismissUpdate: () => void
}

/**
 * Hook to manage the PWA service worker lifecycle.
 *
 * - Registers the service worker
 * - Sets up periodic update checks (every 1 hour)
 * - Implements 24-hour auto-update timeout
 */
export function useServiceWorker(): UseServiceWorkerReturn {
  const autoUpdateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      // Set up periodic update checks
      if (registration) {
        setInterval(() => {
          void registration.update()
        }, UPDATE_CHECK_INTERVAL_MS)
      }
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error)
    },
  })

  // 24-hour auto-update logic
  useEffect(() => {
    if (needRefresh) {
      // Store detection timestamp if not already stored
      try {
        const existing = localStorage.getItem(SW_UPDATE_DETECTED_KEY)
        if (!existing) {
          localStorage.setItem(SW_UPDATE_DETECTED_KEY, Date.now().toString())
        }
      } catch {
        // localStorage may be unavailable
      }

      // Check if 24h has elapsed
      const checkAutoUpdate = () => {
        try {
          const detectedStr = localStorage.getItem(SW_UPDATE_DETECTED_KEY)
          if (!detectedStr) return
          const elapsed = Date.now() - parseInt(detectedStr, 10)
          if (elapsed >= AUTO_UPDATE_TIMEOUT_MS) {
            void updateServiceWorker(true)
            localStorage.removeItem(SW_UPDATE_DETECTED_KEY)
          }
        } catch {
          // localStorage may be unavailable
        }
      }

      // Check immediately in case we're resuming after a long period
      checkAutoUpdate()

      // Check periodically
      autoUpdateTimerRef.current = setInterval(checkAutoUpdate, 60 * 1000) // every minute

      return () => {
        if (autoUpdateTimerRef.current) {
          clearInterval(autoUpdateTimerRef.current)
          autoUpdateTimerRef.current = null
        }
      }
    }
  }, [needRefresh, updateServiceWorker])

  // Clean up auto-update key when SW is updated
  useEffect(() => {
    if (!needRefresh) {
      try {
        localStorage.removeItem(SW_UPDATE_DETECTED_KEY)
      } catch {
        // localStorage may be unavailable
      }
    }
  }, [needRefresh])

  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false)
  }, [setOfflineReady])

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false)
  }, [setNeedRefresh])

  return {
    offlineReady,
    needRefresh,
    updateServiceWorker,
    dismissOfflineReady,
    dismissUpdate,
  }
}
