import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Event Create Route - Disabled for Donor PWA
 * Redirects to home - donors cannot create events
 */
export const Route = createFileRoute('/_authenticated/events/create')({
  component: () => <Navigate to="/home" />,
})
