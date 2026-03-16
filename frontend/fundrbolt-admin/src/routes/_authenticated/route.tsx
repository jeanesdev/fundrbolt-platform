import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { hasSeenProfileSetup } from '@/features/auth/complete-profile/utils'

/**
 * Authenticated route wrapper with role-based access control
 *
 * Access Rules:
 * - Unverified users: sent to verify-email
 * - Users with no NPO memberships: allowed into admin for onboarding/getting started
 * - Assigned admin/staff roles: allowed
 * - First login: Redirected to /complete-profile if profile setup not yet seen
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { isAuthenticated, user } = useAuthStore.getState()

    // Check authentication
    if (!isAuthenticated) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    if (user && !user.email_verified) {
      throw redirect({
        to: '/verify-email',
        search: {
          email: user.email,
        },
      })
    }

    // First-login profile prompt: redirect to complete-profile if not yet seen
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
