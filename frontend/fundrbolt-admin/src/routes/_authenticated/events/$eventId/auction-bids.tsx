import { EventAuctionBidsSection } from '@/features/events/sections/EventAuctionBidsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-bids'
)({
  component: EventAuctionBidsSection,
})
