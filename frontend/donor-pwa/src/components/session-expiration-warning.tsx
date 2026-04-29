import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/axios'

interface SessionExpirationWarningProps {
  /**
   * How many seconds of complete inactivity before automatic sign-out.
   * Default: 900 (15 minutes)
   */
  inactivityTimeoutSeconds?: number
  /**
   * How many seconds before token expiry to silently refresh on navigation.
   * Default: 300 (5 minutes)
   */
  autoRefreshThresholdSeconds?: number
}

export function SessionExpirationWarning({
  inactivityTimeoutSeconds = 900,
  autoRefreshThresholdSeconds = 300,
}: SessionExpirationWarningProps) {
  const lastActivityAtRef = useRef<number>(0)
  const lastTrackedActivityAtRef = useRef<number>(0)
  const lastRefreshAttemptRef = useRef<number>(0)

  const router = useRouter()
  const { accessToken, refreshToken, reset } = useAuthStore()

  useEffect(() => {
    if (!accessToken || !refreshToken) return

    lastActivityAtRef.current = Date.now()
    lastTrackedActivityAtRef.current = 0
  }, [accessToken, refreshToken])

  // Parse JWT to get expiration time
  const getTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp ? payload.exp * 1000 : null
    } catch {
      return null
    }
  }, [])

  // Silently refresh the access token
  const silentRefresh = useCallback(async () => {
    if (!refreshToken) return

    const now = Date.now()
    if (now - lastRefreshAttemptRef.current < 30_000) return
    lastRefreshAttemptRef.current = now

    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      })
      useAuthStore.getState().setAccessToken(response.data.access_token)
    } catch {
      // Ignore silent refresh failures; the token will expire naturally
    }
  }, [refreshToken])

  // Automatically sign out immediately
  const signOut = useCallback(() => {
    reset()
    window.location.href = '/sign-in'
  }, [reset])

  const maybeSilentRefresh = useCallback(() => {
    if (!accessToken || !refreshToken) return

    const expiryTime = getTokenExpiry(accessToken)
    if (!expiryTime) return

    const secondsUntilExpiry = Math.floor((expiryTime - Date.now()) / 1000)
    if (
      secondsUntilExpiry <= autoRefreshThresholdSeconds &&
      secondsUntilExpiry > 0
    ) {
      void silentRefresh()
    }
  }, [
    accessToken,
    autoRefreshThresholdSeconds,
    getTokenExpiry,
    refreshToken,
    silentRefresh,
  ])

  const trackActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastTrackedActivityAtRef.current < 1000) return
    lastTrackedActivityAtRef.current = now
    lastActivityAtRef.current = now
    maybeSilentRefresh()
  }, [maybeSilentRefresh])

  // Silently refresh token on navigation when close to expiry
  useEffect(() => {
    if (!accessToken || !refreshToken) return
    const unsubscribe = router.history.subscribe(() => maybeSilentRefresh())
    return unsubscribe
  }, [accessToken, maybeSilentRefresh, refreshToken, router])

  // Track user activity to reset the idle timer
  useEffect(() => {
    if (!accessToken || !refreshToken) return

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'mousemove',
      'touchstart',
      'wheel',
      'scroll',
    ]

    activityEvents.forEach((e) =>
      window.addEventListener(e, trackActivity, { passive: true })
    )
    return () =>
      activityEvents.forEach((e) =>
        window.removeEventListener(e, trackActivity)
      )
  }, [accessToken, refreshToken, trackActivity])

  // Automatically sign out after inactivity timeout
  useEffect(() => {
    if (!accessToken || !refreshToken) return

    const inactivityTimeoutMs = inactivityTimeoutSeconds * 1000

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastActivityAtRef.current >= inactivityTimeoutMs) {
        signOut()
      }
    }, 10_000) // check every 10 s is sufficient

    return () => window.clearInterval(intervalId)
  }, [accessToken, inactivityTimeoutSeconds, refreshToken, signOut])

  return null
}
