import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { InstallPromptBanner } from '@fundrbolt/shared/pwa/install-prompt-banner'
import { UpdateNotification } from '@fundrbolt/shared/pwa/update-notification'
import { useServiceWorker } from '@fundrbolt/shared/pwa/use-service-worker'
import { Toaster } from '@/components/ui/sonner'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { CookieConsentWrapper } from '@/components/legal/cookie-consent-wrapper'
import { NavigationProgress } from '@/components/navigation-progress'
import { SessionExpirationWarning } from '@/components/session-expiration-warning'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})

function RootComponent() {
  const { needRefresh, updateServiceWorker, dismissUpdate } = useServiceWorker()

  return (
    <>
      <NavigationProgress />
      <ConnectionStatus />
      <SessionExpirationWarning />
      <CookieConsentWrapper />
      <UpdateNotification
        needRefresh={needRefresh}
        onRefresh={updateServiceWorker}
        onDismiss={dismissUpdate}
      />
      <Outlet />
      <Toaster duration={5000} />
      <InstallPromptBanner appId='admin' />
    </>
  )
}
