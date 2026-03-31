import { PublicDirectoryExplorer } from '@/components/home/public-directory-explorer'
import { LegalFooter } from '@/components/legal/legal-footer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { getMyInventory } from '@/lib/api/ticket-purchases'
import { useAuthStore } from '@/stores/auth-store'
import { getEffectiveNow } from '@/stores/debug-spoof-store'
import { useEventContextStore } from '@/stores/event-context-store'
import type { RegisteredEventWithBranding } from '@/types/event-branding'
import { colors, LogoWhiteGold } from '@fundrbolt/shared/assets'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Calendar,
  ChevronRight,
  Loader2,
  Shield,
  TicketCheck,
  Users,
} from 'lucide-react'

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
  const now = getEffectiveNow()
  const start = new Date(event.event_datetime)
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursUntil <= -24) return { label: 'Past', bg: colors.secondary.gray }
  if (hoursUntil <= 0)
    return { label: 'Live', bg: colors.status.error }
  return { label: 'Upcoming', bg: colors.status.success }
}

function EventCard({ event }: { event: DisplayEvent }) {
  const status = getStatus(event)
  const thumbnail = event.thumbnail_url || event.npo_logo_url

  return (
    <Link to='/events/$slug' params={{ slug: event.slug }} className='block'>
      <div className='overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-transform active:scale-[0.98]'>
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
              className='h-full w-full object-cover'
            />
          )}
          {/* Bottom-fade overlay so text above info row pops */}
          <div className='absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent' />
          {/* Status badge */}
          <span
            className='absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold text-white'
            style={{ backgroundColor: status.bg }}
          >
            {status.label}
          </span>
          {/* Admin badge */}
          {event.has_admin_access && (
            <span
              className='absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white'
              style={{
                backgroundColor: colors.primary.gold,
                color: colors.primary.navy,
              }}
            >
              <Shield className='h-3 w-3' />
              Admin
            </span>
          )}
        </div>
        {/* Info row */}
        <div className='flex items-center gap-3 px-4 py-3'>
          <div className='min-w-0 flex-1'>
            <p className='truncate font-bold text-gray-900'>{event.name}</p>
            {event.event_datetime && (
              <p className='mt-0.5 flex items-center gap-1.5 text-sm text-gray-500'>
                <Calendar className='h-3.5 w-3.5 flex-shrink-0' />
                <span className='truncate'>
                  {formatEventDate(event.event_datetime)}
                </span>
              </p>
            )}
            {event.npo_name && (
              <p className='mt-0.5 truncate text-xs text-gray-400'>
                {event.npo_name}
              </p>
            )}
          </div>
          <ChevronRight className='h-5 w-5 flex-shrink-0 text-gray-300' />
        </div>
      </div>
    </Link>
  )
}

function TicketSummaryCard({
  event,
}: {
  event: {
    event_id: string
    event_name: string
    event_slug: string
    event_date: string
    total_tickets: number
    assigned_count: number
    registered_count: number
    unassigned_count: number
  }
}) {
  return (
    <div className='rounded-2xl border border-white/10 bg-white p-4 shadow-sm'>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-bold text-gray-900'>{event.event_name}</p>
          <p className='mt-1 flex items-center gap-1.5 text-sm text-gray-500'>
            <Calendar className='h-3.5 w-3.5 flex-shrink-0' />
            <span className='truncate'>
              {formatEventDate(event.event_date)}
            </span>
          </p>
        </div>
        <div className='flex flex-shrink-0 flex-col gap-2'>
          <Button
            asChild
            size='sm'
            className='bg-slate-900 text-white hover:bg-slate-800'
          >
            <Link to='/tickets'>Assign Tickets</Link>
          </Button>
          <Button
            asChild
            size='sm'
            variant='outline'
            className='border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          >
            <Link to='/events/$slug' params={{ slug: event.event_slug }}>
              View Event
            </Link>
          </Button>
        </div>
      </div>

      <div className='mt-4 grid grid-cols-3 gap-2'>
        <div className='rounded-xl bg-gray-50 px-3 py-2'>
          <p className='text-xs font-semibold tracking-wider text-gray-400 uppercase'>
            Tickets
          </p>
          <p className='mt-1 text-lg font-bold text-gray-900'>
            {event.total_tickets}
          </p>
        </div>
        <div className='rounded-xl bg-emerald-50 px-3 py-2'>
          <p className='text-xs font-semibold tracking-wider text-emerald-600 uppercase'>
            Registered
          </p>
          <p className='mt-1 text-lg font-bold text-emerald-700'>
            {event.registered_count}
          </p>
        </div>
        <div className='rounded-xl bg-amber-50 px-3 py-2'>
          <p className='text-xs font-semibold tracking-wider text-amber-600 uppercase'>
            Unassigned
          </p>
          <p className='mt-1 text-lg font-bold text-amber-700'>
            {event.unassigned_count}
          </p>
        </div>
      </div>

      {event.assigned_count > 0 && (
        <div className='mt-3 flex items-center gap-2 text-sm text-gray-500'>
          <Users className='h-4 w-4' />
          <span>{event.assigned_count} assigned to attendees</span>
        </div>
      )}
    </div>
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
  // availableEvents includes both registered + admin-only events (merged by layout)
  const availableEvents = useEventContextStore((state) => state.availableEvents)

  // Same query key as authenticated-layout — TanStack Query deduplicates the request
  const { data: registrationsData, isLoading } = useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  })

  const { data: ticketInventory, isLoading: ticketsLoading } = useQuery({
    queryKey: ['ticket-inventory'],
    queryFn: getMyInventory,
    staleTime: 60 * 1000,
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

  return (
    <div className='flex min-h-screen flex-col bg-slate-950 text-white'>
      {/* Navy header with white/gold logo */}
      <header
        className='sticky top-0 z-50 pt-safe-top'
        style={{ backgroundColor: colors.primary.navy }}
      >
        <div className='relative flex h-16 items-center justify-center px-5'>
          <img src={LogoWhiteGold} alt='FundrBolt' className='h-10' />
          <div className='absolute right-5'>
            <ProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        id='content'
        className='flex-1 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.14),_transparent_32%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] px-4 py-6'
      >
        {isLoading ? (
          <div className='flex flex-col items-center justify-center gap-3 py-20'>
            <Loader2 className='h-8 w-8 animate-spin text-slate-300' />
            <p className='text-sm text-slate-300'>Loading your events…</p>
          </div>
        ) : (
          <div className='space-y-8'>
            {Boolean(ticketsLoading || ticketInventory?.events?.length) && (
              <section className='space-y-4'>
                <div className='flex items-center justify-between gap-3'>
                  <div>
                    <h2 className='flex items-center gap-2 text-lg font-semibold text-white'>
                      <TicketCheck className='h-5 w-5 text-slate-300' />
                      My Tickets
                    </h2>
                    <p className='mt-1 text-sm text-slate-300'>
                      Manage your tickets, assign guests, and register yourself
                      from one place.
                    </p>
                  </div>
                  <Button
                    asChild
                    size='sm'
                    className='bg-slate-900 text-white hover:bg-slate-800'
                  >
                    <Link to='/tickets'>Manage Tickets</Link>
                  </Button>
                </div>

                {ticketsLoading ? (
                  <div className='space-y-3'>
                    <div className='h-28 rounded-2xl border border-white/10 bg-white/5 shadow-sm' />
                    <div className='h-28 rounded-2xl border border-white/10 bg-white/5 shadow-sm' />
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {ticketInventory?.events?.map((event) => (
                      <TicketSummaryCard key={event.event_id} event={event} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {allEvents.length > 0 && (
              <section className='space-y-3'>
                <h2 className='text-sm font-semibold tracking-wider text-slate-400 uppercase'>
                  My Events
                </h2>
                {allEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </section>
            )}

            {allEvents.length === 0 && (
              <PublicDirectoryExplorer
                title='Browse Events and Organizations'
                description="You aren't registered for an event yet. Explore participating organizations and upcoming events here."
              />
            )}
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
