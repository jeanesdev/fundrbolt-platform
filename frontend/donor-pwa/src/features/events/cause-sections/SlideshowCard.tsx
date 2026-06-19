import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from '@/components/ui/carousel'
import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import Autoplay from 'embla-carousel-autoplay'
import { useRef } from 'react'
import { CauseSectionShell } from './CauseSectionShell'

export function SlideshowCard({ card }: { card: PublicCauseSectionCard }) {
  const autoplay = useRef(
    Autoplay({ delay: 10_000, stopOnInteraction: true, stopOnMouseEnter: true })
  )

  return (
    <CauseSectionShell card={card}>
      <Carousel
        plugins={card.slides.length > 1 ? [autoplay.current] : undefined}
        onMouseEnter={
          card.slides.length > 1 ? autoplay.current.stop : undefined
        }
        onMouseLeave={
          card.slides.length > 1 ? autoplay.current.reset : undefined
        }
        opts={{ loop: card.slides.length > 1 }}
        className='mx-auto w-full'
      >
        <CarouselContent>
          {card.slides.map((slide) => (
            <CarouselItem key={slide.id}>
              <div className='rounded-xl bg-white/80 p-2'>
                {slide.slide_variant !== 'text_only' && slide.media_url && (
                  <div className='relative overflow-hidden rounded-xl'>
                    <img
                      src={slide.media_url}
                      alt={slide.alt_text ?? ''}
                      className='h-64 w-full object-cover'
                      loading='lazy'
                    />
                    {slide.slide_variant === 'text_over_image' &&
                      slide.overlay_html && (
                        <div className='absolute inset-0 flex items-end bg-black/35 p-4'>
                          <div
                            className='prose prose-invert prose-sm max-w-none'
                            dangerouslySetInnerHTML={{
                              __html: slide.overlay_html,
                            }}
                          />
                        </div>
                      )}
                  </div>
                )}
                {slide.slide_variant === 'text_only' && slide.overlay_html && (
                  <div
                    className='prose prose-sm max-w-none px-2 py-4'
                    dangerouslySetInnerHTML={{ __html: slide.overlay_html }}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {card.slides.length > 1 && (
          <>
            <CarouselPrevious className='left-2' />
            <CarouselNext className='right-2' />
          </>
        )}
      </Carousel>
    </CauseSectionShell>
  )
}
