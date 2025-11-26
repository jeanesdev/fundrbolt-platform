/**
 * Session Expiry Warning Modal
 *
 * Displays a warning modal 2 minutes before session expires,
 * allowing users to extend their session or logout gracefully.
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getRemainingSessionTime } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'

const TWO_MINUTES_MS = 2 * 60 * 1000

export function SessionExpiryWarning() {
  const [isOpen, setIsOpen] = useState(false)
  const [remainingTime, setRemainingTime] = useState<number>(0)
  const { refreshToken, logout } = useAuthStore()

  // Check session expiry every 30 seconds
  useEffect(() => {
    if (!refreshToken) return

    const checkExpiry = () => {
      const remaining = getRemainingSessionTime()

      // Show warning 2 minutes before expiry
      if (remaining > 0 && remaining <= TWO_MINUTES_MS && !isOpen) {
        setIsOpen(true)
        setRemainingTime(remaining)
      }

      // Auto-logout when expired
      if (remaining === 0 && isOpen) {
        handleLogout()
      }
    }

    // Initial check
    checkExpiry()

    // Set up interval
    const interval = setInterval(checkExpiry, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [refreshToken, isOpen])

  // Update remaining time every second when modal is open
  useEffect(() => {
    if (!isOpen) return

    const updateTime = () => {
      const remaining = getRemainingSessionTime()
      setRemainingTime(remaining)

      // Auto-close and logout if expired
      if (remaining === 0) {
        handleLogout()
      }
    }

    const interval = setInterval(updateTime, 1000) // 1 second

    return () => clearInterval(interval)
  }, [isOpen])

  const handleExtendSession = async () => {
    // Closing the modal will trigger a new API call that refreshes the token
    setIsOpen(false)

    // Make a dummy API call to trigger token refresh via interceptor
    try {
      const apiClient = (await import('@/lib/axios')).default
      await apiClient.get('/events/public')
    } catch {
      // Ignore errors - we just want to trigger the refresh interceptor
    }
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await logout()
    window.location.href = '/sign-in'
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!refreshToken) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-warning" />
            <DialogTitle>Session Expiring Soon</DialogTitle>
          </div>
          <DialogDescription className="space-y-2 pt-2">
            <p>Your session will expire in:</p>
            <p className="text-2xl font-bold text-foreground">
              {formatTime(remainingTime)}
            </p>
            <p className="text-sm">
              You'll be automatically logged out when the timer reaches zero.
              Click "Stay Signed In" to extend your session.
            </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full sm:w-auto"
          >
            Logout Now
          </Button>
          <Button onClick={handleExtendSession} className="w-full sm:w-auto">
            Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
