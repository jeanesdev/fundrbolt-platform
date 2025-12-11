import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * NPO List Route - Disabled for Donor PWA
 * Redirects to home - donors view events, not NPOs directly
 */
export const Route = createFileRoute('/_authenticated/npos/')({
  component: () => <Navigate to="/home" />,
})
