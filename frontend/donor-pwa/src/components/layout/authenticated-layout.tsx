import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { LegalFooter } from '@/components/legal/legal-footer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SkipToMain } from '@/components/skip-to-main'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { useAuth } from '@/hooks/use-auth'
import { useEventContext } from '@/hooks/use-event-context'
import apiClient from '@/lib/axios'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import type { EventContextOption } from '@/stores/event-context-store'
import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { user } = useAuth()
  const { setAvailableEvents } = useEventContext()
  const restoreUserFromRefreshToken = useAuthStore(state => state.restoreUserFromRefreshToken)
  const [isRestoring, setIsRestoring] = useState(true)

  // Restore user from refresh token on mount if needed
  useEffect(() => {
    const restore = async () => {
      const currentUser = useAuthStore.getState().user
      if (!currentUser) {
        try {
          await restoreUserFromRefreshToken()
        } catch (error) {
          console.error('Failed to restore user:', error)
        }
      }
      setIsRestoring(false)
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Fetch events the user is registered for or has admin access to
  const { data: registrationsData } = useQuery({
    queryKey: ['registrations', 'my-events'],
    queryFn: async () => {
      const response = await apiClient.get('/registrations', {
        params: { per_page: 100 }, // Get all registrations
      })
      return response.data
    },
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

  // Populate available events from registrations and admin access
  useEffect(() => {
    const eventMap = new Map<string, EventContextOption>()

    // Add events from registrations
    if (registrationsData?.registrations) {
      registrationsData.registrations.forEach(
        (reg: {
          event_id: string
          event?: {
            id: string
            name: string
            slug: string
            event_date?: string
            npo?: { name: string }
            logo_url?: string
          }
        }) => {
          if (reg.event) {
            eventMap.set(reg.event.id, {
              id: reg.event.id,
              name: reg.event.name,
              slug: reg.event.slug,
              event_date: reg.event.event_date,
              npo_name: reg.event.npo?.name,
              logo_url: reg.event.logo_url,
              has_admin_access: false,
            })
          }
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
          event_date?: string
          npo?: { name: string }
          logo_url?: string
        }) => {
          const existing = eventMap.get(event.id)
          if (existing) {
            // User is registered AND has admin access
            existing.has_admin_access = true
          } else {
            // User has admin access only
            eventMap.set(event.id, {
              id: event.id,
              name: event.name,
              slug: event.slug,
              event_date: event.event_date,
              npo_name: event.npo?.name,
              logo_url: event.logo_url,
              has_admin_access: true,
            })
          }
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
  }, [registrationsData, adminEventsData, setAvailableEvents])

  // Show loading while restoring user
  if (isRestoring) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

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
