import { createFileRoute } from '@tanstack/react-router'
import { EventLinksSection } from '@/features/events/sections/EventLinksSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/links')({
  component: EventLinksSection,
})
