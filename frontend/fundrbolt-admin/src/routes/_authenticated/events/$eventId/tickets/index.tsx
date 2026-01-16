import { TicketPackagesIndexPage } from '@/features/events/tickets/TicketPackagesIndexPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/'
)({
  component: TicketPackagesIndexPage,
});
