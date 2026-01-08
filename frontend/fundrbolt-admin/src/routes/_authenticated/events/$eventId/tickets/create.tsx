import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/create',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/events/$eventId/tickets/create"!</div>
}
