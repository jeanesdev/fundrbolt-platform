import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

/**
 * Authenticated route wrapper with role-based access control
 * 
 * Access Rules:
 * - Donor role: BLOCKED from admin PWA (redirected to 403)
 * - All other roles: Allowed (super_admin, npo_admin, event_coordinator, staff)
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

    // Block Donor role from accessing admin PWA
    if (user?.role === 'donor') {
      throw redirect({
        to: '/403',
        search: {
          message: 'This area is for administrators only. Donors should use the donor portal.',
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
