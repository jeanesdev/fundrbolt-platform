import { createFileRoute } from '@tanstack/react-router'
import { DonorDashboardPage } from '@/features/donor-dashboard'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/donor-dashboard'
)({
  component: DonorDashboardPage,
})
