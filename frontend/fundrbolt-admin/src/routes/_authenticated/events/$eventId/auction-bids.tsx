import { createFileRoute } from '@tanstack/react-router'
import { EventAuctionBidsSection } from '@/features/events/sections/EventAuctionBidsSection'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-bids'
)({
  component: EventAuctionBidsSection,
})
