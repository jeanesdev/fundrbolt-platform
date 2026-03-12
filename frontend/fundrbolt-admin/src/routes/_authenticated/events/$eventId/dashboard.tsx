import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { EventDashboardPage } from '@/features/event-dashboard'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/dashboard'
)({
  beforeLoad: () => {
    const { user } = useAuthStore.getState()
    const allowedRoles = new Set([
      'super_admin',
      'npo_admin',
      'npo_staff',
      'event_coordinator',
      'staff',
    ])

    if (!user?.role || !allowedRoles.has(user.role)) {
      throw redirect({ to: '/403' })
    }
  },
  component: EventDashboardPage,
})
