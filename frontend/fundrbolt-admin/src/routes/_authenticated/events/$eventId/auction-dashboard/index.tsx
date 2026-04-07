import { createFileRoute } from '@tanstack/react-router'
import { AuctionDashboardPage } from '@/features/auction-dashboard'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-dashboard/',
)({
  component: AuctionDashboardPage,
})
