/**
 * Event Detail Route
 * Displays event information with branding (Phase 4)
 * Parent route for /events/$slug/register
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { EventBrandingProvider } from '@/contexts/EventBrandingContext'
import { useAuthStore } from '@/stores/auth-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { useNotificationSocket } from '@/hooks/use-notification-socket'
import { usePushNotifications } from '@/hooks/use-push-notifications'

export const Route = createFileRoute('/events/$slug')({
  component: EventLayout,
})

function EventLayout() {
  const selectedEventId = useEventContextStore((s) => s.selectedEventId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Keep Socket.IO connected for real-time notification toasts on event pages
  // (this route tree is outside _authenticated, so AuthenticatedLayout's hook
  // doesn't run here)
  useNotificationSocket(selectedEventId ?? undefined)

  // Auto-restore push subscription if permission was previously granted (e.g. after PWA reinstall)
  // Only run for authenticated users to avoid unauthenticated API calls
  usePushNotifications({ enabled: isAuthenticated })

  return (
    <EventBrandingProvider>
      <div
        className='min-h-screen'
        style={{
          backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        }}
      >
        <Outlet />
      </div>
    </EventBrandingProvider>
  )
}
