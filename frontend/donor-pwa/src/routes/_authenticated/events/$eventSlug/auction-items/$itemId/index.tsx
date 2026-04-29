import { createFileRoute } from '@tanstack/react-router'
import { AuctionItemDetailPage } from '@/features/events/auction-items/AuctionItemDetailPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventSlug/auction-items/$itemId/'
)({
  component: AuctionItemDetailPage,
})
