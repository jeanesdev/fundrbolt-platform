import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import {
  hasSeenProfileSetup,
  markProfileSetupSeen,
} from '@/features/auth/complete-profile/utils'

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
      // If the user already completed setup on another device (email verified +
      // name present), just mark it seen locally instead of re-prompting.
      const profileAlreadyComplete =
        user.communications_email_verified &&
        user.communications_email &&
        user.first_name &&
        user.last_name

      if (profileAlreadyComplete) {
        markProfileSetupSeen(user.id)
      } else {
        throw redirect({
          to: '/complete-profile',
          search: {
            redirect: location.href,
          },
        })
      }
    }
  },
  component: AuthenticatedLayout,
})
