import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/tickets/$packageId/edit',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>Hello "/_authenticated/events/$eventId/tickets/$packageId/edit"!</div>
  )
}
