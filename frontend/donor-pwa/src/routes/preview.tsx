import { PreviewEventPage } from '@/features/preview/PreviewEventPage'
import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/preview')({
  validateSearch: (search: Record<string, unknown>) => ({
    eventId: typeof search.eventId === 'string' ? search.eventId : undefined,
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { eventId, token } = Route.useSearch()

  if (!eventId) {
    return <Outlet />
  }

  return <PreviewEventPage eventId={eventId} token={token} />
}
