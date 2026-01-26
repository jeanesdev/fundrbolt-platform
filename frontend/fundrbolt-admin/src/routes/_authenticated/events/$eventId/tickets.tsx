import { EventTicketsSection } from '@/features/events/sections/EventTicketsSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/tickets')({
  component: EventTicketsSection,
})
