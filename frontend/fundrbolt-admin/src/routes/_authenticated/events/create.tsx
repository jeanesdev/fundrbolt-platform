import { createFileRoute } from '@tanstack/react-router'
import { EventCreatePage } from '@/features/events/EventCreatePage'

export const Route = createFileRoute('/_authenticated/events/create')({
  component: EventCreatePage,
})
