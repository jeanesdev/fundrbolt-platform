import { createFileRoute } from '@tanstack/react-router'
import { AuctionItemCreatePage } from '@/features/events/auction-items/AuctionItemCreatePage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventSlug/auction-items/create'
)({
  component: AuctionItemCreatePage,
})
