/**
 * Event Detail Route
 * Displays event information with branding (Phase 4)
 * Parent route for /events/$slug/register
 */

import { EventBrandingProvider } from '@/contexts/EventBrandingContext'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/events/$slug')({
  component: EventLayout,
})

function EventLayout() {
  return (
    <EventBrandingProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    </EventBrandingProvider>
  )
}
