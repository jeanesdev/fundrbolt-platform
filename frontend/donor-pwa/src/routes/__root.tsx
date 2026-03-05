import { CookieConsentWrapper } from '@/components/legal/cookie-consent-wrapper'
import { NavigationProgress } from '@/components/navigation-progress'
import { OfflineStatusBar } from '@/components/pwa/offline-status-bar'
import { SessionExpirationWarning } from '@/components/session-expiration-warning'
import { Toaster } from '@/components/ui/sonner'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { InstallPromptBanner } from '@fundrbolt/shared/pwa/install-prompt-banner'
import { useOnlineStatus } from '@fundrbolt/shared/pwa/use-online-status'
import { UpdateNotification } from '@fundrbolt/shared/pwa/update-notification'
import { useServiceWorker } from '@fundrbolt/shared/pwa/use-service-worker'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

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

  return (
    <>
      <OfflineStatusBar isOnline={isOnline} />
      <NavigationProgress />
      <SessionExpirationWarning />
      <CookieConsentWrapper />
      <UpdateNotification
        needRefresh={needRefresh}
        onRefresh={updateServiceWorker}
        onDismiss={dismissUpdate}
      />
      <Outlet />
      <Toaster duration={5000} />
      <InstallPromptBanner appId="donor" />
    </>
  )
}
