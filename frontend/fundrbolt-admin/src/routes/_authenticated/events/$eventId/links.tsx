import { EventLinksSection } from '@/features/events/sections/EventLinksSection'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/links')({
  component: EventLinksSection,
})
