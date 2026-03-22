/**
 * Ticket Listing Layout — /events/$slug/tickets
 * Renders the ticket listing index route and checkout child routes.
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/events/$slug/tickets')({
  component: TicketListingPage,
})

function TicketListingPage() {
  return <Outlet />
}
