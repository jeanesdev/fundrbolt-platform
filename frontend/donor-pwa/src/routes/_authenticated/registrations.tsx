/**
 * User Registrations Route - Disabled for Donor PWA
 * Users select events from dropdown, not from registrations list
 */

import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/registrations')({
  component: () => <Navigate to="/home" />,
})
