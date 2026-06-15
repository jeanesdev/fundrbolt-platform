import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { EventNotificationsSection } from '@/features/events/sections/EventNotificationsSection'

const notificationsSearchSchema = z.object({
  audience: z.string().optional(),
  item_id: z.string().optional(),
  rg_item_id: z.string().optional(),
})

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/notifications'
)({
  validateSearch: notificationsSearchSchema,
  component: EventNotificationsSection,
})
