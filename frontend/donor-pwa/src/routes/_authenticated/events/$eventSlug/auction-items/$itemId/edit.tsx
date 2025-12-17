import { AuctionItemEditPage } from '@/features/events/auction-items/AuctionItemEditPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventSlug/auction-items/$itemId/edit'
)({
  component: AuctionItemEditPage,
});
