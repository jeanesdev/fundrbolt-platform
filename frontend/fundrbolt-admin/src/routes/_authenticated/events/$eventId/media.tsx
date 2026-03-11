import { createFileRoute } from '@tanstack/react-router'
import { EventMediaSection } from '@/features/events/sections/EventMediaSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/media')({
  component: EventMediaSection,
})
