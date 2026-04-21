import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/npos/$npoId/donate-now/info')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/npos/$npoId/donate-now/setup',
      params: { npoId: params.npoId },
      replace: true,
    })
  },
  component: () => null,
})
