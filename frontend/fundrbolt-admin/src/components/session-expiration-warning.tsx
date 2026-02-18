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
import { useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

interface SessionExpirationWarningProps {
  /**
   * How many seconds before inactivity timeout to show warning
   * Default: 120 (2 minutes)
   */
  warningThresholdSeconds?: number
}

export function SessionExpirationWarning({
  warningThresholdSeconds = 120,
}: SessionExpirationWarningProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const [isExtending, setIsExtending] = useState(false)
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0)

  const idleTimeoutMs = 15 * 60 * 1000
  const lastActivityRef = useRef<number>(Date.now())
  const idleTimeoutRef = useRef<number | null>(null)

  const locationHref = useRouterState({ select: (state) => state.location.href })
  const { accessToken, refreshToken, reset } = useAuthStore()

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
        setSecondsRemaining(null)
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

  const recordActivity = useCallback((shouldRefresh: boolean) => {
    lastActivityRef.current = Date.now()
    setIsOpen(false)
    setSecondsRemaining(null)

    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current)
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      handleLogout()
    }, idleTimeoutMs)

    if (shouldRefresh && accessToken && refreshToken) {
      handleExtendSession(true)
    }
  }, [accessToken, refreshToken, handleExtendSession, handleLogout, idleTimeoutMs])

  // Track activity and refresh on focus/visibility
  useEffect(() => {
    if (!accessToken || !refreshToken) {
      setIsOpen(false)
      setSecondsRemaining(null)
      return
    }

    recordActivity(false)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        recordActivity(true)
      }
    }

    const handleFocus = () => {
      recordActivity(true)
    }

    const handleUserActivity = () => {
      recordActivity(false)
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('mousemove', handleUserActivity)
    window.addEventListener('mousedown', handleUserActivity)
    window.addEventListener('keydown', handleUserActivity)
    window.addEventListener('scroll', handleUserActivity)
    window.addEventListener('touchstart', handleUserActivity)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('mousemove', handleUserActivity)
      window.removeEventListener('mousedown', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
      window.removeEventListener('scroll', handleUserActivity)
      window.removeEventListener('touchstart', handleUserActivity)
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current)
      }
    }
  }, [accessToken, refreshToken, recordActivity])

  // Refresh on route change
  useEffect(() => {
    if (!accessToken || !refreshToken) {
      return
    }

    recordActivity(true)
  }, [accessToken, refreshToken, locationHref, recordActivity])

  // Monitor inactivity warning countdown
  useEffect(() => {
    if (!accessToken) {
      setIsOpen(false)
      setSecondsRemaining(null)
      return
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const idleMs = now - lastActivityRef.current
      const remainingMs = idleTimeoutMs - idleMs
      const remainingSeconds = Math.floor(remainingMs / 1000)

      if (remainingSeconds <= warningThresholdSeconds && remainingSeconds > 0) {
        setSecondsRemaining(remainingSeconds)
        setIsOpen(true)
      }

      if (remainingSeconds <= 0) {
        window.clearInterval(intervalId)
        handleLogout()
      }
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [accessToken, handleLogout, idleTimeoutMs, warningThresholdSeconds])

  // Format seconds as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader className='text-start'>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-2'>
              <p>Your session will end due to inactivity in:</p>
              <p className='text-foreground text-2xl font-bold'>
                {secondsRemaining !== null
                  ? formatTime(secondsRemaining)
                  : '--:--'}
              </p>
              <p className='text-sm'>
                Would you like to extend your session or log out now?
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
