import { createFileRoute } from '@tanstack/react-router'
import { LiveAuctionTab } from '@/features/auctioneer'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auctioneer/live'
)({
  component: LiveAuctionTab,
})
