import { AuctioneerDashboard } from '@/components/dashboards/AuctioneerDashboard'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auctioneer/'
)({
  component: AuctioneerDashboard,
})
