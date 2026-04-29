/**
 * PushOptInPrompt — inline card prompting the user to enable push notifications
 *
 * Shows an inline banner (not a modal) that can be dismissed.
 * Dismissal is persisted in localStorage.
 */
import { useCallback, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { usePushNotifications } from '@/hooks/use-push-notifications'

const DISMISS_KEY = 'push-notification-prompt-dismissed'

function isDismissed(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      return true
    }

    if ('Notification' in window && Notification.permission !== 'default') {
      return true
    }

    return false
  } catch {
    return false
  }
}

function persistDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true')
  } catch {
    // Ignore storage errors
  }
}

export function PushOptInPrompt() {
  const { isSupported, isSubscribed, isLoading, subscribe } =
    usePushNotifications()
  const [dismissed, setDismissed] = useState(isDismissed)

  const handleDismiss = useCallback(() => {
    persistDismissed()
    setDismissed(true)
  }, [])

  const handleEnable = useCallback(async () => {
    await subscribe()
    if ('Notification' in window && Notification.permission !== 'default') {
      persistDismissed()
      setDismissed(true)
    }
  }, [subscribe])

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed) {
    return null
  }

  return (
    <div
      className='relative mx-4 mb-4 rounded-xl border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
        backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.08)',
      }}
    >
      <button
        type='button'
        onClick={handleDismiss}
        className='text-muted-foreground hover:bg-muted absolute top-1 right-1 flex h-10 w-10 items-center justify-center rounded-full'
        style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
        aria-label='Dismiss'
      >
        <X className='h-4 w-4' />
      </button>

      <div className='flex items-start gap-3'>
        <div
          className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full'
          style={{
            backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.14)',
          }}
        >
          <Bell
            className='h-5 w-5'
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          />
        </div>
        <div className='flex-1'>
          <p
            className='text-base leading-tight font-bold'
            style={{ color: 'var(--event-text-on-background, #111827)' }}
          >
            Stay in the loop!
          </p>
          <p
            className='mt-0.5 text-xs'
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          >
            Enable notifications for outbid alerts and auction updates.
          </p>
          <div className='mt-3 flex gap-2'>
            <button
              type='button'
              onClick={handleEnable}
              disabled={isLoading}
              className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50'
            >
              {isLoading ? 'Enabling...' : 'Enable'}
            </button>
            <button
              type='button'
              onClick={handleDismiss}
              className='text-muted-foreground hover:bg-muted rounded-lg px-4 py-1.5 text-xs font-medium transition-colors'
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
