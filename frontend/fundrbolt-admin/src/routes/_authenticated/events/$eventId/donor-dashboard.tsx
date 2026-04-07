import { DonorDashboardPage } from '@/features/donor-dashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/donor-dashboard'
)({
  component: DonorDashboardPage,
})
