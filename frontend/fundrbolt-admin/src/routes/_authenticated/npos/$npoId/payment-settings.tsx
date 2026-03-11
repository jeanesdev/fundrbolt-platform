import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/npos/$npoId/payment-settings'
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/npos/$npoId/payment-settings"!</div>
}
