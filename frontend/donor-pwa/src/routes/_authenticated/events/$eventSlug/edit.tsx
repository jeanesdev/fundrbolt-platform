import { createFileRoute, Navigate, useParams } from '@tanstack/react-router'

/**
 * Event Edit Route - Disabled for Donor PWA
 * Redirects to view page - donors cannot edit events
 */
function RedirectToView() {
  const { eventSlug } = useParams({
    from: '/_authenticated/events/$eventSlug/edit',
  })
  return <Navigate to="/events/$slug" params={{ slug: eventSlug }} />
}

export const Route = createFileRoute('/_authenticated/events/$eventSlug/edit')({
  component: RedirectToView,
})
