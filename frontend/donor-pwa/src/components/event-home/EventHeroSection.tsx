/**
 * EventHeroSection — Cinematic hero header for the event home page
 *
 * Features:
 * - Full-width gradient (event primary → secondary) or banner image
 * - Event name, NPO name with entrance animations (no avatar clutter when no logo)
 * - Status badge: LIVE (red glow) / UPCOMING (blue) / PAST (grey)
 * - Date + venue chips
 * - EventSwitcher dropdown + Profile button in top corners
 */

import { Calendar, MapPin, Radio } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

export type EventStatus = 'live' | 'upcoming' | 'past'
export type HeroTransitionStyle = 'documentary_style' | 'fade' | 'swipe' | 'simple'

const documentaryKeyframes = ['heroKenBurnsA', 'heroKenBurnsB', 'heroKenBurnsC', 'heroKenBurnsD'] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export interface EventHeroSectionProps {
  eventName: string
  npoName?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  bannerImages?: string[]
  eventDate?: string | null
  venueName?: string | null
  status: EventStatus
  transitionStyle?: HeroTransitionStyle
  onAddToCalendar?: () => void
  venueMapLink?: string | null
  /** Slot for the event-switcher dropdown (rendered top-left) */
  switcherSlot?: ReactNode
  /** Slot for the profile button (rendered top-right) */
  profileSlot?: ReactNode
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

  return null
}

export function EventHeroSection({
  eventName,
  npoName,
  logoUrl,
  bannerUrl,
  bannerImages,
  eventDate,
  venueName,
  status,
  transitionStyle = 'documentary_style',
  onAddToCalendar,
  venueMapLink,
  switcherSlot,
  profileSlot,
}: EventHeroSectionProps) {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [failedBannerUrls, setFailedBannerUrls] = useState<Record<string, true>>({})

  const sourceBannerImages =
    bannerImages?.filter((url) => !!url) ?? (bannerUrl ? [bannerUrl] : [])

  const visibleBannerImages = sourceBannerImages.filter((url) => !failedBannerUrls[url])
  const showBanner = visibleBannerImages.length > 0
  const safeActiveBannerIndex =
    visibleBannerImages.length > 0
      ? activeBannerIndex % visibleBannerImages.length
      : 0

  useEffect(() => {
    if (visibleBannerImages.length === 0) return

    if (visibleBannerImages.length === 1) return

    const intervalByStyle: Record<HeroTransitionStyle, number> = {
      documentary_style: 7000,
      fade: 5000,
      swipe: 5000,
      simple: 4000,
    }

    const intervalId = window.setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % visibleBannerImages.length)
    }, intervalByStyle[transitionStyle])

    return () => {
      window.clearInterval(intervalId)
    }
  }, [transitionStyle, visibleBannerImages.length])

  const getDocumentaryMotionStyle = (imageUrl: string, isActive: boolean) => {
    const seed = hashString(`${imageUrl}:${transitionStyle}`)
    const keyframe = documentaryKeyframes[seed % documentaryKeyframes.length]
    const animationDuration = `${7.2 + (seed % 4) * 0.45}s`
    const offsetX = 48 + (seed % 5)
    const offsetY = 48 + ((seed >> 3) % 5)
    const brightness = 0.97 + ((seed % 5) * 0.015)
    const saturate = 0.98 + (((seed >> 2) % 5) * 0.03)
    const contrast = 0.98 + (((seed >> 4) % 4) * 0.02)

    return {
      opacity: isActive ? 1 : 0,
      transform: 'scale(1.03)',
      transition: 'opacity 900ms ease',
      animation: `${keyframe} ${animationDuration} ease-in-out infinite alternate`,
      backgroundPosition: `${offsetX}% ${offsetY}%`,
      filter: `brightness(${brightness}) saturate(${saturate}) contrast(${contrast})`,
    }
  }

  const getSlideStyle = (index: number, imageUrl: string) => {
    const isActive = index === safeActiveBannerIndex
    const isSwipe = transitionStyle === 'swipe'
    const duration = transitionStyle === 'simple' ? '400ms' : '900ms'

    if (isSwipe) {
      const distance =
        visibleBannerImages.length > 0
          ? (index - safeActiveBannerIndex + visibleBannerImages.length) % visibleBannerImages.length
          : 0
      const swipeOffset = distance === 1 ? '10%' : '-10%'

      return {
        opacity: isActive ? 1 : 0,
        transform: isActive ? 'translateX(0%) scale(1.02)' : `translateX(${swipeOffset}) scale(1.02)`,
        transition: `opacity ${duration} ease, transform ${duration} ease`,
      }
    }

    if (transitionStyle === 'simple') {
      return {
        opacity: isActive ? 1 : 0,
        transform: 'scale(1)',
        transition: `opacity ${duration} linear`,
      }
    }

    if (transitionStyle === 'fade') {
      return {
        opacity: isActive ? 1 : 0,
        transform: 'scale(1)',
        transition: `opacity ${duration} ease`,
        animation: 'none',
        filter: 'none',
      }
    }

    return getDocumentaryMotionStyle(imageUrl, isActive)
  }

  return (
    <div
      className='relative'
      style={{ minHeight: '220px', height: 'min(60vw, 300px)' }}
    >
      <style>{`
        @keyframes heroKenBurnsA {
          0% { transform: scale(1.02) translate3d(-1.5%, -1%, 0); }
          50% { transform: scale(1.08) translate3d(1.5%, 1%, 0); }
          100% { transform: scale(1.1) translate3d(0%, 0%, 0); }
        }
        @keyframes heroKenBurnsB {
          0% { transform: scale(1.02) translate3d(1.5%, -1.5%, 0); }
          50% { transform: scale(1.07) translate3d(-1.5%, 1%, 0); }
          100% { transform: scale(1.1) translate3d(0.5%, 0%, 0); }
        }
        @keyframes heroKenBurnsC {
          0% { transform: scale(1.03) translate3d(0%, 1.5%, 0); }
          50% { transform: scale(1.08) translate3d(2%, -1%, 0); }
          100% { transform: scale(1.11) translate3d(-1%, 0%, 0); }
        }
        @keyframes heroKenBurnsD {
          0% { transform: scale(1.01) translate3d(-2%, 1%, 0); }
          50% { transform: scale(1.08) translate3d(1%, -1.5%, 0); }
          100% { transform: scale(1.1) translate3d(1.5%, 0.5%, 0); }
        }
      `}</style>
      {/* Background */}
      {showBanner ? (
        <div className='absolute inset-0 overflow-hidden'>
          {visibleBannerImages.map((imageUrl, index) => (
            <div
              key={imageUrl}
              className='absolute inset-0 bg-cover bg-center will-change-transform'
              style={{
                backgroundImage: `url(${imageUrl})`,
                ...getSlideStyle(index, imageUrl),
              }}
            >
              <img
                src={imageUrl}
                alt=''
                className='hidden'
                onError={() => {
                  setFailedBannerUrls((prev) => ({ ...prev, [imageUrl]: true }))
                }}
              />
            </div>
          ))}
          <div className='absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80' />
        </div>
      ) : (
        <div
          className='absolute inset-0 overflow-hidden'
          style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
        >
          <div className='absolute inset-0 bg-black/25' />
        </div>
      )}

      {/* If there's a logo image, show it as a small badge in top-left */}
      {logoUrl && (
        <div className='absolute left-3 z-10' style={{ top: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)' }}>
          <div className='animate-float'>
            <img
              src={logoUrl}
              alt={eventName}
              className='h-14 w-14 rounded-xl border-2 border-white/60 shadow-2xl object-cover'
            />
          </div>
        </div>
      )}

      {/* Top bar: switcher left, profile right */}
      <div
        className='absolute top-0 left-0 right-0 flex items-start justify-between px-3 z-20'
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
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

      {/* Bottom: event name + meta — main content area */}
      <div className='absolute bottom-0 left-0 right-0 px-4 pb-4 z-10'>
        {/* gradient scrim for text legibility */}
        <div className='absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 to-transparent -z-10 pointer-events-none' />

        <div className='animate-hero-enter stagger-1'>
          <div className='mb-2'>
            <StatusBadge status={status} />
          </div>
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
        <div className='mt-2.5 flex flex-wrap items-center gap-2 animate-hero-enter stagger-2'>
          {eventDate && (
            <button
              onClick={onAddToCalendar}
              className='inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm transition-all hover:bg-black/55 active:scale-95'
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
              className='inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white/95 backdrop-blur-sm transition-all hover:bg-black/55 active:scale-95'
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
