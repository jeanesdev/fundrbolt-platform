import { createFileRoute } from '@tanstack/react-router'
import { AuctionItemDetailPage } from '@/features/auction-dashboard/AuctionItemDetailPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-dashboard/items/$itemId'
)({
  component: AuctionItemDetailPage,
})
