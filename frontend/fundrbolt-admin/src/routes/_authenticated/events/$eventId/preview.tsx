import { createFileRoute } from '@tanstack/react-router'
import { EventPreviewSection } from '@/features/events/sections/EventPreviewSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/preview')(
  {
    component: EventPreviewSection,
  }
)
