import { createFileRoute } from '@tanstack/react-router'
import { AuctionItemEditPage } from '@/features/events/auction-items/AuctionItemEditPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventSlug/auction-items/$itemId/edit'
)({
  component: AuctionItemEditPage,
})
