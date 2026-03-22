/**
 * PushOptInPrompt — inline card prompting the user to enable push notifications
 *
 * Shows an inline banner (not a modal) that can be dismissed.
 * Dismissal is persisted in localStorage.
 */
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Bell, X } from 'lucide-react'
import { useCallback, useState } from 'react'

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
    <div className='border-primary/20 bg-primary/5 relative mx-4 mb-4 rounded-xl border p-4'>
      <button
        type='button'
        onClick={handleDismiss}
        className='text-muted-foreground hover:bg-muted absolute top-2 right-2 rounded-full p-1'
        aria-label='Dismiss'
      >
        <X className='h-4 w-4' />
      </button>

      <div className='flex items-start gap-3'>
        <div className='bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full'>
          <Bell className='text-primary h-5 w-5' />
        </div>
        <div className='flex-1'>
          <p className='text-foreground text-base font-bold leading-tight'>
            Stay in the loop!
          </p>
          <p className='text-muted-foreground mt-0.5 text-xs'>
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
