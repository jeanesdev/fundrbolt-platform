/**
 * EventHeader Component
 *
 * Displays event branding: logo, banner, and title with primary color styling.
 * Handles missing images with graceful fallbacks.
 */

import type { EventDetailResponse } from '@/lib/api/events'
import { useState } from 'react'

interface EventHeaderProps {
  event: EventDetailResponse
}

export function EventHeader({ event }: EventHeaderProps) {
  const [bannerError, setBannerError] = useState(false)
  const [logoError, setLogoError] = useState(false)

  const hasBanner = event.banner_url && !bannerError
  const hasLogo = event.logo_url && !logoError

  return (
    <div className="relative w-full">
      {/* Banner Image */}
      {hasBanner ? (
        <div className="relative h-64 w-full overflow-hidden md:h-80 lg:h-96">
          <img
            src={event.banner_url!}
            alt={`${event.name} banner`}
            className="h-full w-full object-cover"
            onError={() => setBannerError(true)}
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        </div>
      ) : (
        /* Fallback colored banner using event primary color */
        <div
          className="relative h-64 w-full md:h-80 lg:h-96"
          style={{ backgroundColor: `rgb(var(--event-primary))` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
        </div>
      )}

      {/* Logo and Title Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
        {/* Logo */}
        {hasLogo && (
          <div className="mb-4 h-24 w-24 overflow-hidden rounded-full bg-white p-2 shadow-lg md:h-32 md:w-32">
            <img
              src={event.logo_url!}
              alt={`${event.name} logo`}
              className="h-full w-full object-contain"
              onError={() => setLogoError(true)}
            />
          </div>
        )}

        {/* Event Name */}
        <h1 className="text-3xl font-bold drop-shadow-lg md:text-4xl lg:text-5xl">
          {event.name}
        </h1>

        {/* Event Tagline */}
        {event.tagline && (
          <p className="mt-2 max-w-2xl text-lg drop-shadow-md md:text-xl">
            {event.tagline}
          </p>
        )}
      </div>
    </div>
  )
}
