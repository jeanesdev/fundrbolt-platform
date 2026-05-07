import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/events/$eventId/payments'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/events/$eventId/checkout',
      params: { eventId: params.eventId },
      replace: true,
    })
  },
  component: () => null,
})
