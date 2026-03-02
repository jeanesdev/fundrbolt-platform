import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SessionExpirationWarningProps {
  /**
   * How many seconds of no activity before showing warning
   * Default: 900 (15 minutes)
   */
  inactivityTimeoutSeconds?: number
  /**
   * How many seconds before expiry to auto-refresh on navigation
   * Default: 300 (5 minutes)
   */
  autoRefreshThresholdSeconds?: number
}

export function SessionExpirationWarning({
  inactivityTimeoutSeconds = 900,
  autoRefreshThresholdSeconds = 300,
}: SessionExpirationWarningProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0)
  const lastActivityAtRef = useRef<number>(Date.now())
  const lastTrackedActivityAtRef = useRef<number>(0)

  const router = useRouter()
  const { accessToken, refreshToken, reset } = useAuthStore()

  // Parse JWT to get expiration time
  const getTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp ? payload.exp * 1000 : null // Convert to milliseconds
    } catch {
      return null
    }
  }, [])

  // Extend session by refreshing the access token
  const handleExtendSession = useCallback(async (silent = false) => {
    if (!refreshToken) return false

    // Prevent too frequent refresh attempts (minimum 30 seconds between)
    const now = Date.now()
    if (now - lastRefreshAttempt < 30000) {
      return false
    }

    if (!silent) {
      setIsExtending(true)
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      })

      const { access_token } = response.data
      useAuthStore.getState().setAccessToken(access_token)
      setLastRefreshAttempt(now)

      // Close dialog on success
      if (!silent) {
        setIsOpen(false)
        lastActivityAtRef.current = Date.now()
        lastTrackedActivityAtRef.current = Date.now()
      }

      return true
    } catch {
      // If refresh fails, only logout if this was a user action
      if (!silent) {
        reset()
        window.location.href = '/sign-in'
      }
      return false
    } finally {
      if (!silent) {
        setIsExtending(false)
      }
    }
  }, [refreshToken, reset, lastRefreshAttempt])

  // Handle logout
  const handleLogout = useCallback(() => {
    reset()
    window.location.href = '/sign-in'
  }, [reset])

  const maybeSilentRefresh = useCallback(() => {
    if (!accessToken || !refreshToken) return

    const expiryTime = getTokenExpiry(accessToken)
    if (!expiryTime) return

    const now = Date.now()
    const secondsUntilExpiry = Math.floor((expiryTime - now) / 1000)

    if (secondsUntilExpiry <= autoRefreshThresholdSeconds && secondsUntilExpiry > 0) {
      void handleExtendSession(true)
    }
  }, [
    accessToken,
    autoRefreshThresholdSeconds,
    getTokenExpiry,
    handleExtendSession,
    refreshToken,
  ])

  const trackActivity = useCallback(() => {
    const now = Date.now()

    if (now - lastTrackedActivityAtRef.current < 1000) {
      return
    }

    lastTrackedActivityAtRef.current = now
    lastActivityAtRef.current = now

    if (isOpen) {
      setIsOpen(false)
    }

    maybeSilentRefresh()
  }, [isOpen, maybeSilentRefresh])

  // Auto-refresh token on navigation if it's getting close to expiry
  useEffect(() => {
    if (!accessToken || !refreshToken) return

    // Listen to router location changes
    const checkAndRefresh = () => {
      maybeSilentRefresh()
    }

    // Subscribe to router history changes
    const unsubscribe = router.history.subscribe(checkAndRefresh)

    return unsubscribe
  }, [accessToken, maybeSilentRefresh, refreshToken, router])

  // Track user activity and reset idle timer on interaction
  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setIsOpen(false)
      return
    }

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'mousemove',
      'touchstart',
      'wheel',
      'scroll',
    ]

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, trackActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, trackActivity)
      })
    }
  }, [accessToken, refreshToken, trackActivity])

  // Show warning after inactivity timeout
  useEffect(() => {
    if (!accessToken || !refreshToken) {
      return
    }

    const inactivityTimeoutMs = inactivityTimeoutSeconds * 1000

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const inactiveMs = now - lastActivityAtRef.current

      if (inactiveMs >= inactivityTimeoutMs) {
        setIsOpen(true)
      }
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [accessToken, inactivityTimeoutSeconds, refreshToken])

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader className='text-start'>
          <AlertDialogTitle>Session Paused</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-2'>
              <p>
                You have been inactive for 15 minutes.
              </p>
              <p className='text-sm'>
                Continue to stay logged in, or log out now.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant='outline'
            onClick={handleLogout}
            disabled={isExtending}
          >
            Log Out
          </Button>
          <Button onClick={() => handleExtendSession(false)} disabled={isExtending}>
            {isExtending ? 'Extending...' : 'Stay Logged In'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
