import { LiveAuctionTab } from '@/features/auctioneer'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auctioneer/live'
)({
  component: LiveAuctionTab,
})
