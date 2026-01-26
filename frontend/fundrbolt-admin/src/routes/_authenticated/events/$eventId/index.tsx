import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/events/$eventId/details',
      params,
    })
  },
})
