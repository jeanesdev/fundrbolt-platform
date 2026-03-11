import { createFileRoute } from '@tanstack/react-router'
import { EventFoodSection } from '@/features/events/sections/EventFoodSection'

export const Route = createFileRoute('/_authenticated/events/$eventId/food')({
  component: EventFoodSection,
})
