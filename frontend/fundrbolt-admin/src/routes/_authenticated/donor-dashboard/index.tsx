import { DonorDashboardPage } from '@/features/donor-dashboard/DonorDashboardPage'
import { useAuthStore } from '@/stores/auth-store'
import { createFileRoute, redirect } from '@tanstack/react-router'

const ALLOWED_ROLES = [
  'super_admin',
  'npo_admin',
  'event_coordinator',
  'auctioneer',
  'staff',
]

export const Route = createFileRoute('/_authenticated/donor-dashboard/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user
    if (!user) {
      throw redirect({ to: '/sign-in' })
    }
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw redirect({ to: '/' })
    }
  },
  component: DonorDashboardPage,
})
