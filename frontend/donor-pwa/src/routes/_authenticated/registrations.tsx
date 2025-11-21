/**
 * User Registrations Route
 * Displays user's event registrations (Phase 8 - deferred)
 * Placeholder for future implementation
 */

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/registrations')({
  component: RegistrationsPage,
})

function RegistrationsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">My Registrations</h1>
      <p className="text-muted-foreground">
        This page will show your event registrations (Phase 8 - coming soon)
      </p>
    </div>
  )
}
