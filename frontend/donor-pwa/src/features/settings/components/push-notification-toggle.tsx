/**
 * PushNotificationToggle — card for enabling/disabling push notifications
 * on the settings page (always visible, unlike PushOptInPrompt which is dismissible).
 */
import { AlertTriangle, Bell, Download } from 'lucide-react'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Switch } from '@/components/ui/switch'

/** Detect iOS Safari not running as installed PWA */
function isIOSBrowserMode(): boolean {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    'standalone' in navigator &&
    (navigator as { standalone?: boolean }).standalone
  return isIOS && !isStandalone
}

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } =
    usePushNotifications()

  const permissionDenied =
    'Notification' in window && Notification.permission === 'denied'
  const iosBrowserMode = isIOSBrowserMode()

  if (!isSupported) {
    if (iosBrowserMode) {
      return (
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='flex items-center gap-3'>
            <Download className='text-primary h-5 w-5 flex-shrink-0' />
            <div>
              <p className='text-sm font-medium'>Install to Enable Push</p>
              <p className='text-muted-foreground text-xs'>
                On iPhone, push notifications require the app to be installed to
                your Home Screen.
              </p>
            </div>
          </div>
          <div className='text-muted-foreground bg-muted/50 rounded-md px-3 py-2 text-xs'>
            Tap the <strong>Share</strong> button (square with arrow) in Safari,
            then <strong>Add to Home Screen</strong>.
          </div>
        </div>
      )
    }
    return (
      <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'>
        <AlertTriangle className='h-4 w-4 flex-shrink-0' />
        Push notifications are not supported on this device / browser.
      </div>
    )
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  return (
    <div className='space-y-2'>
      <label className='flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4'>
        <div className='flex items-center gap-3'>
          <Bell className='text-muted-foreground h-5 w-5 flex-shrink-0' />
          <div>
            <p className='text-sm font-medium'>Push Notifications</p>
            <p className='text-muted-foreground text-xs'>
              {isSubscribed
                ? 'You will receive alerts even when the app is closed.'
                : 'Enable to get outbid alerts, auction updates, and more.'}
            </p>
          </div>
        </div>
        <Switch
          checked={isSubscribed}
          onCheckedChange={() => void handleToggle()}
          disabled={isLoading || permissionDenied}
        />
      </label>
      {permissionDenied && (
        <div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'>
          <AlertTriangle className='h-4 w-4 flex-shrink-0' />
          Notifications are blocked. Open your browser or device settings to
          allow notifications for this site, then try again.
        </div>
      )}
    </div>
  )
}
