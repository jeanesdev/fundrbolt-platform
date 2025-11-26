import { EventCreatePage } from '@/features/events/EventCreatePage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/create')({
  component: EventCreatePage,
})
