import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/npos/$npoId/payment-settings'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/npos/$npoId/edit',
      params: { npoId: params.npoId },
      search: { tab: 'payments' },
      replace: true,
    })
  },
})
