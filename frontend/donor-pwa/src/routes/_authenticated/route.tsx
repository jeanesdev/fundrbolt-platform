import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { hasSeenProfileSetup } from '@/features/auth/complete-profile/utils'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Authenticated route wrapper for donor PWA
 *
 * All authenticated users can access this area.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { isAuthenticated, user } = useAuthStore.getState()

    // Check authentication - allow if user is authenticated OR has valid refresh token
    // The component will handle restoration if needed
    if (!isAuthenticated && !hasValidRefreshToken()) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    // Prompt for profile completion on first sign-in after email verification
    if (user && !hasSeenProfileSetup(user.id)) {
      throw redirect({
        to: '/complete-profile',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
