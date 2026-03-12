import { createFileRoute } from '@tanstack/react-router'
import { EventEditPage } from '@/features/events/EventEditPage'

export const Route = createFileRoute('/_authenticated/events/$eventId')({
  component: EventEditPage,
})
