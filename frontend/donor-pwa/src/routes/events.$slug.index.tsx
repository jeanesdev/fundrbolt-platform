import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/events/$slug/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/events/$slug/"!</div>
}
