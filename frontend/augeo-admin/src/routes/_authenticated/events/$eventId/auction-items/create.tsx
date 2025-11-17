import { AuctionItemCreatePage } from '@/features/events/auction-items/AuctionItemCreatePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/auction-items/create'
)({
  component: AuctionItemCreatePage,
});
