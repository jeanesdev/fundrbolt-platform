import { createFileRoute } from '@tanstack/react-router'
import { AuctionItemsIndexPage } from '@/features/events/auction-items/AuctionItemsIndexPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-items/'
)({
  component: AuctionItemsIndexPage,
})
