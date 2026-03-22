/**
 * Ticket Listing Layout — /events/$slug/tickets
 * Layout route that renders child routes (listing index + checkout).
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/events/tickets')({
  component: () => <Outlet />,
})
