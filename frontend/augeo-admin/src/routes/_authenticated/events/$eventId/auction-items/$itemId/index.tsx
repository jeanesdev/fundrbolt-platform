import { AuctionItemDetailPage } from '@/features/events/auction-items/AuctionItemDetailPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-items/$itemId/'
)({
  component: AuctionItemDetailPage,
});
