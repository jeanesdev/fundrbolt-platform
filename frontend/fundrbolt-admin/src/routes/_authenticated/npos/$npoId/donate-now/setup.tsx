import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/npos/$npoId/donate-now/setup',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/npos/$npoId/donate-now/setup"!</div>
}
