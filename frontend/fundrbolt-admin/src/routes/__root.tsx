import { CookieConsentWrapper } from '@/components/legal/cookie-consent-wrapper'
import { NavigationProgress } from '@/components/navigation-progress'
import { SessionExpirationWarning } from '@/components/session-expiration-warning'
import { Toaster } from '@/components/ui/sonner'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { type QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <SessionExpirationWarning />
        <CookieConsentWrapper />
        <Outlet />
        <Toaster duration={5000} />
      </>
    )
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
