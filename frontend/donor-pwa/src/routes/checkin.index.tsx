import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkin/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/checkin/"!</div>
}
