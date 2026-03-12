import { createFileRoute } from '@tanstack/react-router'
import { EventListPage } from '@/features/events/EventListPage'

export const Route = createFileRoute('/_authenticated/events/')({
  component: EventListPage,
})
