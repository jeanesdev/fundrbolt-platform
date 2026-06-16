import { createFileRoute } from '@tanstack/react-router'
import { CauseSectionsPage } from '@/features/events/cause-sections/CauseSectionsPage'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/cause-sections'
)({
  component: CauseSectionsPage,
})
