import { AuctioneerDashboardPage } from '@/features/auctioneer'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auctioneer/'
)({
  component: AuctioneerDashboardPage,
})
