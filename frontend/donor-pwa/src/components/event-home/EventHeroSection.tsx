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
        className='animate-live-glow inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white'
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
        className='inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white'
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
    : `linear-gradient(135deg, rgb(var(--event-primary, 59, 130, 246)) 0%, rgb(var(--event-secondary, 147, 51, 234)) 100%)`

  return (
    <div className='relative overflow-hidden' style={{ minHeight: '52vw', maxHeight: '320px' }}>
      {/* Background */}
      {bannerUrl ? (
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          {/* Dark overlay for readability */}
          <div className='absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70' />
        </div>
      ) : (
        <div className='absolute inset-0' style={{ background: heroBackground }}>
          {/* Subtle shimmer overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20' />
          {/* Decorative circles */}
          <div
            className='absolute -top-12 -right-12 h-48 w-48 rounded-full opacity-20'
            style={{ backgroundColor: 'rgb(var(--event-secondary, 147, 51, 234))' }}
          />
          <div
            className='absolute -bottom-8 -left-8 h-32 w-32 rounded-full opacity-15'
            style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
          />
        </div>
      )}

      {/* Top bar: switcher left, profile right */}
      <div className='absolute top-0 left-0 right-0 flex items-start justify-between px-3 pt-3 z-10'>
        {switcherSlot ? (
          <div className='rounded-xl bg-black/30 backdrop-blur-md'>
            {switcherSlot}
          </div>
        ) : (
          <div />
        )}
        {profileSlot && (
          <div className='rounded-xl bg-black/30 p-0.5 backdrop-blur-md'>
            {profileSlot}
          </div>
        )}
      </div>

      {/* Center: logo */}
      <div className='absolute inset-0 flex flex-col items-center justify-center z-10 pt-8'>
        <div className='animate-float mb-2'>
          <Avatar className='h-16 w-16 border-2 border-white/50 shadow-2xl'>
            <AvatarImage src={logoUrl ?? undefined} alt={eventName} />
            <AvatarFallback
              className='text-lg font-bold text-white'
              style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.6)' }}
            >
              {getInitials(eventName)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className='px-4 text-center animate-hero-enter'>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Bottom: event name + meta */}
      <div className='absolute bottom-0 left-0 right-0 p-3 z-10'>
        <div
          className='animate-hero-enter'
          style={{ animationDelay: '0.1s', opacity: 0 }}
        >
          {npoName && (
            <p className='mb-0.5 text-xs font-medium uppercase tracking-wider text-white/70'>
              {npoName}
            </p>
          )}
          <h1 className='text-xl font-bold leading-tight text-white drop-shadow-lg sm:text-2xl'>
            {eventName}
          </h1>
        </div>

        {/* Date + venue chips */}
        <div
          className='mt-1.5 flex flex-wrap items-center gap-2 animate-hero-enter'
          style={{ animationDelay: '0.2s', opacity: 0 }}
        >
          {eventDate && (
            <button
              onClick={onAddToCalendar}
              className='inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-white/90 backdrop-blur-sm transition-opacity hover:bg-black/40'
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
              className='inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-xs text-white/90 backdrop-blur-sm transition-opacity hover:bg-black/40'
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
