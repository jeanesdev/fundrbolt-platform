import { PreviewEventPage } from '@/features/preview/PreviewEventPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/preview/$eventId')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { eventId } = Route.useParams()
  const { token } = Route.useSearch()

  return <PreviewEventPage eventId={eventId} token={token} />
}
