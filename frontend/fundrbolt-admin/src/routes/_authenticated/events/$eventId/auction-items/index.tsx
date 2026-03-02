import { AuctionItemsIndexPage } from '@/features/events/auction-items/AuctionItemsIndexPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-items/'
)({
  component: AuctionItemsIndexPage,
});
