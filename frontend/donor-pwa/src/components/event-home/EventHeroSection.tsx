/**
 * EventHeroSection — Cinematic hero header for the event home page
 *
 * Features:
 * - Full-width gradient (event primary → secondary) or banner image
 * - Event logo centered with floating animation
 * - Event name, NPO name with entrance animations
 * - Status badge: LIVE (red glow) / UPCOMING (blue) / PAST (grey)
 * - Date + venue chips
 * - EventSwitcher dropdown + Profile button in top corners
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar, MapPin, Radio } from 'lucide-react'
import type { ReactNode } from 'react'

export type EventStatus = 'live' | 'upcoming' | 'past'

export interface EventHeroSectionProps {
  eventName: string
  npoName?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  eventDate?: string | null
  venueName?: string | null
  status: EventStatus
  onAddToCalendar?: () => void
  venueMapLink?: string | null
  /** Slot for the event-switcher dropdown (rendered top-left) */
  switcherSlot?: ReactNode
  /** Slot for the profile button (rendered top-right) */
  profileSlot?: ReactNode
}

function getInitials(name: string): string {
  const words = name.split(' ').filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0]?.[0] || 'E').toUpperCase()
}

function formatEventDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function StatusBadge({ status }: { status: EventStatus }) {
  if (status === 'live') {
    return (
      <span
        className='animate-live-glow inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg'
        style={{ backgroundColor: 'rgb(239, 68, 68)' }}
      >
        <Radio className='h-3 w-3 animate-pulse' />
        Live Now
      </span>
    )
  }

  if (status === 'upcoming') {
    return (
      <span
        className='inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg'
        style={{
          backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.9)',
        }}
      >
        ⏰ Upcoming
      </span>
    )
  }

  return (
    <span className='inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80'>
      ✓ Past Event
    </span>
  )
}

export function EventHeroSection({
  eventName,
  npoName,
  logoUrl,
  bannerUrl,
  eventDate,
  venueName,
  status,
  onAddToCalendar,
  venueMapLink,
  switcherSlot,
  profileSlot,
}: EventHeroSectionProps) {
  const heroBackground = bannerUrl
    ? undefined
    : `linear-gradient(150deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 60%, rgb(var(--event-primary, 59, 130, 246) / 0.8) 100%)`

  return (
    <div
      className='relative'
      style={{ minHeight: '260px', height: 'min(68vw, 340px)' }}
    >
      {/* Background */}
      {bannerUrl ? (
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          <div className='absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/75' />
        </div>
      ) : (
        <div className='absolute inset-0 overflow-hidden' style={{ background: heroBackground }}>
          {/* Animated shimmer overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30' />
          {/* Decorative glowing circles */}
          <div
            className='absolute -top-16 -right-16 h-64 w-64 rounded-full opacity-25 blur-xl'
            style={{ backgroundColor: 'rgb(var(--event-secondary, 147, 51, 234))' }}
          />
          <div
            className='absolute -bottom-12 -left-12 h-48 w-48 rounded-full opacity-20 blur-lg'
            style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
          />
          <div
            className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full opacity-10 blur-2xl'
            style={{ backgroundColor: 'rgb(255, 255, 255)' }}
          />
        </div>
      )}

      {/* Top bar: switcher left, profile right */}
      <div className='absolute top-0 left-0 right-0 flex items-start justify-between px-3 pt-safe-top pt-3 z-20'>
        {switcherSlot ? (
          <div className='rounded-xl bg-black/40 backdrop-blur-md shadow-lg'>
            {switcherSlot}
          </div>
        ) : (
          <div />
        )}
        {profileSlot && (
          <div className='rounded-xl bg-black/40 backdrop-blur-md shadow-lg overflow-visible'>
            {profileSlot}
          </div>
        )}
      </div>

      {/* Center: logo + status badge */}
      <div className='absolute inset-0 flex flex-col items-center justify-center z-10 pt-10'>
        <div className='animate-float'>
          <Avatar className='h-20 w-20 border-2 border-white/60 shadow-2xl ring-4 ring-white/20'>
            <AvatarImage src={logoUrl ?? undefined} alt={eventName} />
            <AvatarFallback
              className='text-2xl font-black text-white'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.5)' }}
            >
              {getInitials(eventName)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className='mt-2 animate-hero-enter'>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Bottom: event name + meta */}
      <div className='absolute bottom-0 left-0 right-0 px-4 pb-3 z-10'>
        {/* subtle gradient for text legibility */}
        <div className='absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent -z-10 pointer-events-none' />

        <div className='animate-hero-enter stagger-2'>
          {npoName && (
            <p className='mb-0.5 text-xs font-semibold uppercase tracking-widest text-white/70'>
              {npoName}
            </p>
          )}
          <h1 className='text-2xl font-black leading-tight text-white drop-shadow-lg sm:text-3xl'>
            {eventName}
          </h1>
        </div>

        {/* Date + venue chips */}
        <div className='mt-2 flex flex-wrap items-center gap-2 animate-hero-enter stagger-3'>
          {eventDate && (
            <button
              onClick={onAddToCalendar}
              className='inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm transition-all hover:bg-black/50 active:scale-95'
            >
              <Calendar className='h-3 w-3' />
              {formatEventDate(eventDate)}
            </button>
          )}
          {venueName && (
            <a
              href={venueMapLink ?? undefined}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm transition-all hover:bg-black/50 active:scale-95'
              onClick={(e) => !venueMapLink && e.preventDefault()}
            >
              <MapPin className='h-3 w-3' />
              {venueName}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
