import { EventEditPage } from '@/features/events/EventEditPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/edit')({
  component: EventEditPage,
})
