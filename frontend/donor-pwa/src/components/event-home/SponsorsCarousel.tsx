/**
 * SponsorsCarousel Component
 *
 * Auto-playing carousel that displays event sponsors.
 * Automatically transitions through sponsors in a loop.
 */

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { getEventSponsors, type Sponsor } from '@/lib/api/sponsors'
import { useQuery } from '@tanstack/react-query'
import Autoplay from 'embla-carousel-autoplay'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useRef } from 'react'

interface SponsorsCarouselProps {
  eventId: string
  className?: string
}

export function SponsorsCarousel({ eventId, className }: SponsorsCarouselProps) {
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }))

  // Fetch sponsors
  const {
    data: sponsors,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sponsors', eventId],
    queryFn: () => getEventSponsors(eventId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className || ''}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center gap-2 py-8 text-muted-foreground ${className || ''}`}>
        <AlertCircle className="h-5 w-5" />
        <span>Unable to load sponsors</span>
      </div>
    )
  }

  // No sponsors
  if (!sponsors || sponsors.length === 0) {
    return null // Don't show anything if there are no sponsors
  }

  // Get logo size class
  const getLogoSizeClass = (size: Sponsor['logo_size']) => {
    switch (size) {
      case 'xsmall':
        return 'h-16'
      case 'small':
        return 'h-24'
      case 'medium':
        return 'h-32'
      case 'large':
        return 'h-40'
      case 'xlarge':
        return 'h-48'
      default:
        return 'h-32'
    }
  }

  return (
    <div className={className}>
      <h2 className="text-2xl font-semibold mb-6 text-center">Our Sponsors</h2>

      <Carousel
        plugins={[plugin.current]}
        className="w-full max-w-5xl mx-auto"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
        opts={{
          align: 'start',
          loop: true,
        }}
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {sponsors.map((sponsor) => (
            <CarouselItem
              key={sponsor.id}
              className="pl-2 md:pl-4 basis-full md:basis-1/3 lg:basis-1/4"
            >
              <div className="p-6 h-48 flex items-center justify-center bg-transparent">
                {sponsor.website_url ? (
                  <a
                    href={sponsor.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex items-center justify-center"
                  >
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className={`object-contain ${getLogoSizeClass(sponsor.logo_size)} max-w-full`}
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className={`object-contain ${getLogoSizeClass(sponsor.logo_size)} max-w-full`}
                    loading="lazy"
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>

      {sponsors.length > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          Thank you to our {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
