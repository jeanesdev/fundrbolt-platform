import { TicketPackageCreatePage } from '@/features/events/tickets/TicketPackageCreatePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/create'
)({
  component: TicketPackageCreatePage,
});
