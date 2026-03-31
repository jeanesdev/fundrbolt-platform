import { CookieConsentWrapper } from '@/components/legal/cookie-consent-wrapper'
import { NavigationProgress } from '@/components/navigation-progress'
import { OfflineStatusBar } from '@/components/pwa/offline-status-bar'
import { SessionExpirationWarning } from '@/components/session-expiration-warning'
import { Toaster } from '@/components/ui/sonner'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { InstallPromptBanner } from '@fundrbolt/shared/pwa/install-prompt-banner'
import { UpdateNotification } from '@fundrbolt/shared/pwa/update-notification'
import { useOnlineStatus } from '@fundrbolt/shared/pwa/use-online-status'
import { useServiceWorker } from '@fundrbolt/shared/pwa/use-service-worker'
import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})

function RootComponent() {
  const { needRefresh, updateServiceWorker, dismissUpdate } =
    useServiceWorker()
  const isOnline = useOnlineStatus()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Reset scroll on route change — prevents iOS standalone PWA phantom offset
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <OfflineStatusBar isOnline={isOnline} />
      <NavigationProgress />
      <SessionExpirationWarning />
      <CookieConsentWrapper />
      <UpdateNotification
        needRefresh={!import.meta.env.DEV && needRefresh}
        onRefresh={updateServiceWorker}
        onDismiss={dismissUpdate}
      />
      <Outlet />
      <Toaster duration={5000} />
      <InstallPromptBanner appId="donor" />
    </>
  )
}
