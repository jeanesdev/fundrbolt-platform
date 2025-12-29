import { EventListPage } from '@/features/events/EventListPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/')({
  component: EventListPage,
})
