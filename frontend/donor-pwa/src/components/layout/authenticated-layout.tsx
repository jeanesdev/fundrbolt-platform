import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useMatches } from '@tanstack/react-router'
import { notificationService } from '@/services/notification-service'
import { useAuthStore } from '@/stores/auth-store'
import type { EventContextOption } from '@/stores/event-context-store'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { getMyInventory } from '@/lib/api/ticket-purchases'
import apiClient from '@/lib/axios'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useAuth } from '@/hooks/use-auth'
import { useEventContext } from '@/hooks/use-event-context'
import { useNotificationSocket } from '@/hooks/use-notification-socket'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { SidebarFreeLayout } from '@/components/layout/sidebar-free-layout'
import { LegalFooter } from '@/components/legal/legal-footer'
import { triggerNotificationToast } from '@/components/notifications/NotificationToastOverlay'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { user } = useAuth()
  const { setAvailableEvents, selectedEventId } = useEventContext()
  const restoreUserFromRefreshToken = useAuthStore(
    (state) => state.restoreUserFromRefreshToken
  )
  const [isRestoring, setIsRestoring] = useState(true)
  const matches = useMatches()

  // Check if we're on an event detail page (should use sidebar-free layout)
  const isEventDetailPage = matches.some((match) =>
    match.routeId.includes('/events/$eventSlug')
  )

  // Check if we're on a settings page (should use sidebar-free layout)
  const isSettingsPage = matches.some((match) =>
    match.routeId.includes('/settings')
  )

  // Home page has its own layout (sidebar-free with custom header)
  const isHomePage = matches.some(
    (match) => match.routeId === '/_authenticated/home'
  )

  const isTicketsPage = matches.some(
    (match) =>
      match.routeId === '/_authenticated/tickets' ||
      match.routeId === '/_authenticated/tickets/history'
  )

  // Keep Socket.IO connected across all authenticated pages for real-time toasts
  useNotificationSocket(selectedEventId ?? undefined)

  // Auto-restore push subscription if permission was previously granted (e.g. after PWA reinstall)
  usePushNotifications()

  // Show toast popups for unread notifications on app open / login.
  // After showing them, mark all as read so they don't re-appear next time.
  const shownMissedRef = useRef(false)
  useEffect(() => {
    if (shownMissedRef.current || isRestoring || !user || !selectedEventId)
      return
    shownMissedRef.current = true

    const eventId = selectedEventId
    notificationService
      .listNotifications(eventId, { limit: 5, unread_only: true })
      .then(({ notifications }) => {
        if (notifications.length === 0) return
        // Small stagger so toasts don't all appear at once
        notifications.forEach((n, i) => {
          setTimeout(() => triggerNotificationToast(n), i * 600)
        })
        // Mark them as read so reopening the app won't show the same ones
        notificationService.markAllRead(eventId).catch(() => {})
      })
      .catch(() => {
        // Non-critical — socket will deliver future notifications anyway
      })
  }, [isRestoring, user, selectedEventId])

  // Restore user from refresh token on mount if needed
  useEffect(() => {
    const restore = async () => {
      const currentUser = useAuthStore.getState().user
      if (!currentUser) {
        try {
          await restoreUserFromRefreshToken()
        } catch {
          // Auth guards handle unauthenticated state if refresh restoration fails.
        }
      }
      setIsRestoring(false)
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Fetch events the user is registered for with branding
  const { data: registrationsData } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user && !isRestoring,
  })

  // Also fetch events user has admin access to (if any)
  const { data: adminEventsData } = useQuery({
    queryKey: ['events', 'admin-access'],
    queryFn: async () => {
      const response = await apiClient.get('/events', {
        params: { per_page: 100 },
      })
      return response.data
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !isRestoring,
  })

  const { data: ticketInventoryData } = useQuery({
    queryKey: ['ticket-inventory', 'event-context'],
    queryFn: getMyInventory,
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !isRestoring,
  })

  // Populate available events from registrations and admin access
  useEffect(() => {
    const eventMap = new Map<string, EventContextOption>()

    // Add events from registrations with branding
    if (registrationsData?.events) {
      registrationsData.events.forEach(
        (event: {
          id: string
          name: string
          slug: string
          event_datetime: string
          npo_name: string
          thumbnail_url: string | null
        }) => {
          eventMap.set(event.id, {
            id: event.id,
            name: event.name,
            slug: event.slug,
            event_date: event.event_datetime,
            npo_name: event.npo_name,
            logo_url: event.thumbnail_url,
            is_registered: true,
            has_ticket_access: false,
            has_admin_access: false,
          })
        }
      )
    }

    // Add events user has admin access to (mark them)
    if (adminEventsData?.items) {
      adminEventsData.items.forEach(
        (event: {
          id: string
          name: string
          slug: string
          status?: string
          event_date?: string
          npo?: { name: string }
          logo_url?: string
        }) => {
          const existing = eventMap.get(event.id)
          if (existing) {
            // User is registered AND has admin access
            existing.has_admin_access = true
            existing.status = event.status
          } else {
            // User has admin access only — include all statuses so admins can
            // see and navigate to their own draft events
            eventMap.set(event.id, {
              id: event.id,
              name: event.name,
              slug: event.slug,
              status: event.status,
              event_date: event.event_date,
              npo_name: event.npo?.name,
              logo_url: event.logo_url,
              is_registered: false,
              has_ticket_access: false,
              has_admin_access: true,
            })
          }
        }
      )
    }

    if (ticketInventoryData?.events) {
      ticketInventoryData.events.forEach(
        (event: {
          event_id: string
          event_name: string
          event_slug: string
          event_date: string
        }) => {
          if (eventMap.has(event.event_id)) {
            return
          }

          eventMap.set(event.event_id, {
            id: event.event_id,
            name: event.event_name,
            slug: event.event_slug,
            event_date: event.event_date,
            is_registered: false,
            has_ticket_access: true,
            has_admin_access: false,
          })
        }
      )
    }

    // Sort by event date (upcoming first)
    const events = Array.from(eventMap.values()).sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0
      if (!a.event_date) return 1
      if (!b.event_date) return -1
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    })

    setAvailableEvents(events)
  }, [
    registrationsData,
    adminEventsData,
    ticketInventoryData,
    setAvailableEvents,
  ])

  // Show loading while restoring user
  if (isRestoring) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    )
  }

  // For event detail pages, settings pages, or home page, render sidebar-free layout
  // The child route handles its own full-page layout
  if (isEventDetailPage || isSettingsPage || isHomePage) {
    return (
      <SearchProvider>
        <SkipToMain />
        {children ?? <Outlet />}
      </SearchProvider>
    )
  }

  if (isTicketsPage) {
    return (
      <SidebarFreeLayout headerVariant='brand' showBackButton>
        {children ?? <Outlet />}
      </SidebarFreeLayout>
    )
  }

  // Standard layout with sidebar for other authenticated pages
  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',

              // Flex column layout to push footer to bottom
              'flex flex-col',

              // If layout is fixed, set the height
              // to 100svh to prevent overflow
              'has-[[data-layout=fixed]]:h-svh',

              // If layout is fixed and sidebar is inset,
              // set the height to 100svh - spacing (total margins) to prevent overflow
              'peer-data-[variant=inset]:has-[[data-layout=fixed]]:h-[calc(100svh-(var(--spacing)*4))]'
            )}
          >
            {/* Persistent Header with Profile Dropdown */}
            <Header fixed>
              <div className='ms-auto flex items-center space-x-4'>
                <Search />
                <ProfileDropdown />
              </div>
            </Header>
            <div className='flex-1 p-4 sm:p-6'>{children ?? <Outlet />}</div>
            <LegalFooter />
          </SidebarInset>
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
