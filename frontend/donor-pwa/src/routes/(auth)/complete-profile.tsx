import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/complete-profile')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(auth)/complete-profile"!</div>
}
