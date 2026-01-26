import { EventAuctionItemsSection } from '@/features/events/sections/EventAuctionItemsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/auction-items')({
  component: EventAuctionItemsSection,
})
