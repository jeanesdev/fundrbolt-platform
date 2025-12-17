import { createFileRoute, Navigate, useParams } from '@tanstack/react-router'

/**
 * Event Edit Route - Disabled for Donor PWA
 * Redirects to view page - donors cannot edit events
 */
function RedirectToView() {
  const { eventId } = useParams({ strict: false }) as { eventId: string }
  return <Navigate to="/events/$eventId" params={{ eventId }} />
}

export const Route = createFileRoute('/_authenticated/events/$eventSlug/edit')({
  component: RedirectToView,
})
