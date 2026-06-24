import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import type { PublicCauseSectionCard } from '@/lib/api/cause-section-cards'
import Autoplay from 'embla-carousel-autoplay'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CauseSectionShell } from './CauseSectionShell'

export function SlideshowCard({ card }: { card: PublicCauseSectionCard }) {
  const [api, setApi] = useState<CarouselApi>()
  const [activeIndex, setActiveIndex] = useState(0)
  const [preloadedUrls, setPreloadedUrls] = useState<Set<string>>(new Set())

  const autoplay = useRef(
    Autoplay({ delay: 10_000, stopOnInteraction: true, stopOnMouseEnter: true })
  )

  const slideImageUrls = useMemo(
    () =>
      card.slides.map((slide) => {
        if (!slide.media_url) {
          return null
        }

        const variants = slide.media_variants ?? {}
        return {
          medium: variants.medium ?? null,
          thumbnail: variants.thumbnail ?? null,
          original: slide.media_url,
        }
      }),
    [card.slides]
  )

  const [imageSrcBySlide, setImageSrcBySlide] = useState<Record<string, string>>({})

  useEffect(() => {
    const nextSrcBySlide = card.slides.reduce<Record<string, string>>((acc, slide, index) => {
      const imageSet = slideImageUrls[index]
      if (!imageSet) {
        return acc
      }

      acc[slide.id] = imageSet.medium ?? imageSet.thumbnail ?? imageSet.original
      return acc
    }, {})

    setImageSrcBySlide(nextSrcBySlide)
  }, [card.slides, slideImageUrls])

  useEffect(() => {
    if (!api) {
      return
    }

    const onSelect = () => {
      setActiveIndex(api.selectedScrollSnap())
    }

    onSelect()
    api.on('select', onSelect)
    api.on('reInit', onSelect)

    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api])

  useEffect(() => {
    if (slideImageUrls.length <= 1) {
      return
    }

    const nextIndex = (activeIndex + 1) % slideImageUrls.length
    const nextUrl = slideImageUrls[nextIndex]?.medium
      ?? slideImageUrls[nextIndex]?.thumbnail
      ?? slideImageUrls[nextIndex]?.original

    if (!nextUrl || preloadedUrls.has(nextUrl)) {
      return
    }

    let idleId: number | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const preload = () => {
      const img = new Image()
      img.src = nextUrl
      setPreloadedUrls((prev) => new Set([...prev, nextUrl]))
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(preload, { timeout: 2000 })
    } else {
      timeoutId = setTimeout(preload, 100)
    }

    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }, [activeIndex, preloadedUrls, slideImageUrls])

  return (
    <CauseSectionShell card={card}>
      <Carousel
        setApi={setApi}
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
          {card.slides.map((slide, index) => {
            const imageSet = slideImageUrls[index]
            const imageUrl = imageSrcBySlide[slide.id]
            const nextIndex =
              slideImageUrls.length > 0
                ? (activeIndex + 1) % slideImageUrls.length
                : activeIndex
            const shouldLoad =
              index === activeIndex
              || index === nextIndex
              || (imageUrl ? preloadedUrls.has(imageUrl) : false)

            return (
              <CarouselItem key={slide.id}>
                <div className='rounded-xl bg-white/80 p-2'>
                  {slide.slide_variant !== 'text_only' && slide.media_url && (
                    <div className='relative overflow-hidden rounded-xl'>
                      {imageUrl && imageSet && (
                        <img
                          src={shouldLoad ? imageUrl : undefined}
                          alt={slide.alt_text ?? ''}
                          className='h-64 w-full object-cover'
                          loading={index === activeIndex ? 'eager' : 'lazy'}
                          decoding='async'
                          onError={() => {
                            setImageSrcBySlide((prev) => {
                              const current = prev[slide.id]
                              const next =
                                current === imageSet.medium
                                  ? (imageSet.thumbnail ?? imageSet.original)
                                  : imageSet.original
                              if (!next || current === next) {
                                return prev
                              }
                              return { ...prev, [slide.id]: next }
                            })
                          }}
                        />
                      )}
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
            )
          })}
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
