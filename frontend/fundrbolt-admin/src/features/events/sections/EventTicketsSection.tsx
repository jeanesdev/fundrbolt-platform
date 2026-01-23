import { TicketPackagesIndexPage } from '../tickets/TicketPackagesIndexPage'
import { useEventWorkspace } from '../EventWorkspaceContext'

export function EventTicketsSection() {
  const { currentEvent } = useEventWorkspace()
  return <TicketPackagesIndexPage eventId={currentEvent.id} />
}
