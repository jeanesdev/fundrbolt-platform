import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Event Layout Route
 *
 * Parent layout bypasses sidebar for immersive event experience.
 * This route just passes through to child routes.
 */
export const Route = createFileRoute('/_authenticated/events/$eventSlug')({
  component: EventLayout,
})

function EventLayout() {
  return <Outlet />
}
