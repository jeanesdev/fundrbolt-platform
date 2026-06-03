import { CookieConsentWrapper } from '@/components/legal/cookie-consent-wrapper'
import { NavigationProgress } from '@/components/navigation-progress'
import { NotificationToastOverlay } from '@/components/notifications/NotificationToastOverlay'
import { OfflineStatusBar } from '@/components/pwa/offline-status-bar'
import { SessionExpirationWarning } from '@/components/session-expiration-warning'
import { Toaster } from '@/components/ui/sonner'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { useIsMobile } from '@/hooks/use-mobile'
import { InstallPromptBanner } from '@fundrbolt/shared/pwa/install-prompt-banner'
import { PullToRefresh } from '@fundrbolt/shared/pwa/pull-to-refresh'
import { UpdateNotification } from '@fundrbolt/shared/pwa/update-notification'
import { useOnlineStatus } from '@fundrbolt/shared/pwa/use-online-status'
import { useServiceWorker } from '@fundrbolt/shared/pwa/use-service-worker'
import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})

function RootComponent() {
  const isMobile = useIsMobile()
  const { needRefresh, updateServiceWorker, dismissUpdate } = useServiceWorker()
  const isOnline = useOnlineStatus()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [cookieConsentShowing, setCookieConsentShowing] = useState(false)

  // Reset scroll on route change — prevents iOS standalone PWA phantom offset
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <OfflineStatusBar isOnline={isOnline} />
      <NavigationProgress />
      <PullToRefresh />
      <SessionExpirationWarning />
      <CookieConsentWrapper onOpenChange={setCookieConsentShowing} />
      <UpdateNotification
        needRefresh={!import.meta.env.DEV && needRefresh}
        onRefresh={updateServiceWorker}
        onDismiss={dismissUpdate}
      />
      <Outlet />
      <Toaster closeButton position='top-center' offset='calc(env(safe-area-inset-top, 0px) + 8px)' mobileOffset='calc(env(safe-area-inset-top, 0px) + 8px)' toastOptions={{ duration: 5000 }} />
      <NotificationToastOverlay />
      {isMobile && <InstallPromptBanner appId='donor' hidden={cookieConsentShowing} />}
    </>
  )
}
