import { createFileRoute } from '@tanstack/react-router'
import { AuctioneerDashboardPage } from '@/features/auctioneer'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auctioneer/'
)({
  component: AuctioneerDashboardPage,
})
