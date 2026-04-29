/**
 * SponsorsCarousel Component
 *
 * Auto-playing carousel that displays event sponsors.
 * Automatically transitions through sponsors in a loop.
 */
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import Autoplay from 'embla-carousel-autoplay'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  getEventSponsors,
  getPublicEventSponsors,
  type Sponsor,
} from '@/lib/api/sponsors'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

interface SponsorsCarouselProps {
  eventId?: string
  /** When provided, fetches sponsors via the public (no-auth) endpoint using event slug */
  publicSlug?: string
  className?: string
}

export function SponsorsCarousel({
  eventId,
  publicSlug,
  className,
}: SponsorsCarouselProps) {
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }))

  const queryKey = publicSlug
    ? ['sponsors', 'public', publicSlug]
    : ['sponsors', eventId]
  const queryFn = publicSlug
    ? () => getPublicEventSponsors(publicSlug)
    : () => getEventSponsors(eventId!)

  // Fetch sponsors
  const {
    data: sponsors,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn,
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!(eventId || publicSlug),
  })

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center py-8 ${className || ''}`}
      >
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        className={`text-muted-foreground flex items-center justify-center gap-2 py-8 ${className || ''}`}
      >
        <AlertCircle className='h-5 w-5' />
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
      <Carousel
        plugins={[plugin.current]}
        className='mx-auto w-full max-w-5xl'
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
        opts={{
          align: 'start',
          loop: true,
        }}
      >
        <CarouselContent className='-ml-2 md:-ml-4'>
          {sponsors.map((sponsor) => (
            <CarouselItem
              key={sponsor.id}
              className='basis-full pl-2 md:basis-1/3 md:pl-4 lg:basis-1/4'
            >
              <div className='flex h-48 items-center justify-center bg-transparent p-6'>
                {sponsor.website_url ? (
                  <a
                    href={sponsor.website_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex h-full w-full items-center justify-center'
                  >
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.name}
                      className={`object-contain ${getLogoSizeClass(sponsor.logo_size)} max-w-full`}
                      loading='lazy'
                    />
                  </a>
                ) : (
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className={`object-contain ${getLogoSizeClass(sponsor.logo_size)} max-w-full`}
                    loading='lazy'
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}
