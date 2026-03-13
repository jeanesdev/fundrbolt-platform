import { LegalFooter } from '@/components/legal/legal-footer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { useAuthStore } from '@/stores/auth-store'
import { useEventContextStore } from '@/stores/event-context-store'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import { colors, LogoWhiteGold } from '@fundrbolt/shared/assets'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Calendar, ChevronRight, Loader2, Shield } from 'lucide-react'

// Unified display type — registered events plus admin-only events mapped to same shape
type DisplayEvent = RegisteredEventWithBranding & { has_admin_access?: boolean }

function formatEventDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatus(event: DisplayEvent): { label: string; bg: string } {
  if (event.is_past) return { label: 'Past', bg: colors.secondary.gray }
  const now = new Date()
  const start = new Date(event.event_datetime)
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursUntil <= 0 && hoursUntil > -24) return { label: 'Live', bg: colors.status.error }
  return { label: 'Upcoming', bg: colors.status.success }
}

function EventCard({ event }: { event: DisplayEvent }) {
  const status = getStatus(event)
  const thumbnail = event.thumbnail_url || event.npo_logo_url

  return (
    <Link to='/events/$eventSlug' params={{ eventSlug: event.slug }} className='block'>
      <div className='bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-transform active:scale-[0.98]'>
        {/* Hero: thumbnail image or branding gradient */}
        <div
          className='relative h-28'
          style={{
            background: thumbnail
              ? undefined
              : `linear-gradient(135deg, ${event.primary_color} 0%, ${event.secondary_color} 100%)`,
          }}
        >
          {thumbnail && (
            <img
              src={thumbnail}
              alt=''
              className='w-full h-full object-cover'
            />
          )}
          {/* Bottom-fade overlay so text above info row pops */}
          <div className='absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent' />
          {/* Status badge */}
          <span
            className='absolute top-3 left-3 text-xs font-semibold text-white px-2.5 py-1 rounded-full'
            style={{ backgroundColor: status.bg }}
          >
            {status.label}
          </span>
          {/* Admin badge */}
          {event.has_admin_access && (
            <span
              className='absolute top-3 right-3 flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1 rounded-full'
              style={{ backgroundColor: colors.primary.gold, color: colors.primary.navy }}
            >
              <Shield className='h-3 w-3' />
              Admin
            </span>
          )}
        </div>
        {/* Info row */}
        <div className='flex items-center gap-3 px-4 py-3'>
          <div className='flex-1 min-w-0'>
            <p className='font-bold text-gray-900 truncate'>{event.name}</p>
            {event.event_datetime && (
              <p className='flex items-center gap-1.5 text-sm text-gray-500 mt-0.5'>
                <Calendar className='h-3.5 w-3.5 flex-shrink-0' />
                <span className='truncate'>{formatEventDate(event.event_datetime)}</span>
              </p>
            )}
            {event.npo_name && (
              <p className='text-xs text-gray-400 truncate mt-0.5'>{event.npo_name}</p>
            )}
          </div>
          <ChevronRight className='h-5 w-5 text-gray-300 flex-shrink-0' />
        </div>
      </div>
    </Link>
  )
}

/**
 * Donor PWA Home Page
 *
 * Shows all events the user is registered for or has admin access to.
 * Uses a sidebar-free layout with the FundrBolt navy header.
 */
function DonorHomePage() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  // availableEvents includes both registered + admin-only events (merged by layout)
  const availableEvents = useEventContextStore((state) => state.availableEvents)

  // Same query key as authenticated-layout — TanStack Query deduplicates the request
  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  const registeredEvents: DisplayEvent[] = registrationsData?.events ?? []
  const registeredIds = new Set(registeredEvents.map((e) => e.id))

  // Admin-only events: present in the context store (has_admin_access=true) but
  // not in the registrations response. Shown with limited display data.
  const adminOnlyEvents: DisplayEvent[] = availableEvents
    .filter((e) => e.has_admin_access && !registeredIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      event_datetime: e.event_date ?? '',
      timezone: '',
      is_past: e.event_date ? new Date(e.event_date) < new Date() : false,
      is_upcoming: e.event_date ? new Date(e.event_date) > new Date() : false,
      thumbnail_url: e.logo_url ?? null,
      primary_color: colors.accent.violet,
      secondary_color: colors.accent.plum,
      background_color: colors.secondary.white,
      accent_color: colors.primary.gold,
      npo_name: e.npo_name ?? '',
      npo_logo_url: null,
      has_admin_access: true,
    }))

  const allEvents = [...registeredEvents, ...adminOnlyEvents]

  // Auto-redirect when the user only has one event
  useEffect(() => {
    if (!isLoading && allEvents.length === 1) {
      void navigate({ to: '/events/$eventSlug', params: { eventSlug: allEvents[0].slug } })
    }
  }, [isLoading, allEvents.length, allEvents[0]?.slug, navigate])

  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      {/* Navy header with white/gold logo */}
      <header
        className='sticky top-0 z-50'
        style={{ backgroundColor: colors.primary.navy }}
      >
        <div className='flex h-14 items-center justify-between px-5'>
          <img src={LogoWhiteGold} alt='FundrBolt' className='h-7' />
          <ProfileDropdown />
        </div>
      </header>

      {/* Main content */}
      <main id='content' className='flex-1 px-4 py-6'>
        {isLoading ? (
          <div className='flex flex-col items-center justify-center py-20 gap-3'>
            <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
            <p className='text-sm text-gray-500'>Loading your events…</p>
          </div>
        ) : allEvents.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-20 text-center gap-3'>
            <div className='h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-2'>
              <Calendar className='h-8 w-8 text-gray-400' />
            </div>
            <h2 className='text-lg font-semibold text-gray-900'>No events yet</h2>
            <p className='text-sm text-gray-500 max-w-xs'>
              You haven't been registered for any events. Check back soon!
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            <h2 className='text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4'>
              My Events
            </h2>
            {allEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>

      <LegalFooter />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/home')({
  component: DonorHomePage,
})

