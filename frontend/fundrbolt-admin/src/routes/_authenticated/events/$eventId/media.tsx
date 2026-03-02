import { EventMediaSection } from '@/features/events/sections/EventMediaSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/media')({
  component: EventMediaSection,
})
