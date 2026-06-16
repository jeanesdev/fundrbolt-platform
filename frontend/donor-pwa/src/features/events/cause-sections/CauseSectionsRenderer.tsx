import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  getPublishedCausePageCards,
  type PublicCauseSectionCard,
} from '@/lib/api/cause-section-cards'
import { EventDetails } from '@/components/event-home/EventDetails'
import { SponsorsCarousel } from '@/components/event-home/SponsorsCarousel'
import { CauseSectionShell } from './CauseSectionShell'
import { SlideshowCard } from './SlideshowCard'
import { TextCard } from './TextCard'
import { VideoCard } from './VideoCard'

interface CauseSectionsRendererProps {
  eventId: string
  event: {
    description?: string | null
    event_datetime?: string | null
    timezone?: string | null
    venue_name?: string | null
    venue_address?: string | null
    venue_city?: string | null
    venue_state?: string | null
    venue_zip?: string | null
    attire?: string | null
    primary_contact_email?: string | null
    primary_contact_phone?: string | null
    links?: Array<{ link_type?: string; url?: string | null }> | null
  }
  currentEventForSwitcher?: {
    is_past?: boolean
    is_upcoming?: boolean
  } | null
  aboutEventHtml: string
  fallback?: ReactNode
}

function AboutBuiltInCard({
  card,
  aboutEventHtml,
}: {
  card: PublicCauseSectionCard
  aboutEventHtml: string
}) {
  if (!aboutEventHtml) return null
  return (
    <CauseSectionShell card={card}>
      <div
        className='prose prose-sm max-w-none text-slate-700'
        dangerouslySetInnerHTML={{ __html: aboutEventHtml }}
      />
    </CauseSectionShell>
  )
}

function EventDetailsBuiltInCard({
  card,
  event,
  currentEventForSwitcher,
}: Pick<CauseSectionsRendererProps, 'event' | 'currentEventForSwitcher'> & {
  card: PublicCauseSectionCard
}) {
  return (
    <CauseSectionShell card={card}>
      <EventDetails
        className='border-0 bg-transparent p-0 shadow-none'
        eventDatetime={event.event_datetime ?? ''}
        timezone={event.timezone ?? undefined}
        venueName={event.venue_name ?? undefined}
        venueAddress={event.venue_address ?? undefined}
        venueCity={event.venue_city ?? undefined}
        venueState={event.venue_state ?? undefined}
        venueZip={event.venue_zip ?? undefined}
        attire={event.attire ?? undefined}
        contactEmail={event.primary_contact_email ?? undefined}
        contactPhone={event.primary_contact_phone ?? undefined}
        eventWebsite={
          event.links?.find((link) => link.link_type === 'website')?.url ?? null
        }
        isPast={currentEventForSwitcher?.is_past}
        isUpcoming={currentEventForSwitcher?.is_upcoming}
      />
    </CauseSectionShell>
  )
}

function SponsorsBuiltInCard({
  card,
  eventId,
}: {
  card: PublicCauseSectionCard
  eventId: string
}) {
  return (
    <CauseSectionShell card={card}>
      <SponsorsCarousel eventId={eventId} />
    </CauseSectionShell>
  )
}

export function CauseSectionsRenderer({
  eventId,
  event,
  currentEventForSwitcher,
  aboutEventHtml,
  fallback = null,
}: CauseSectionsRendererProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cause-page-cards', 'public', eventId],
    queryFn: () => getPublishedCausePageCards(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      fallback ?? (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='h-6 w-6 animate-spin text-slate-500' />
        </div>
      )
    )
  }

  if (isError || !data || data.length === 0) {
    return <>{fallback}</>
  }

  const cards = data
    .filter((card) => card.is_enabled)
    .sort((a, b) => a.display_order - b.display_order)

  return (
    <div className='space-y-4'>
      {cards.map((card) => {
        if (card.card_type === 'text') {
          return <TextCard key={card.id} card={card} />
        }

        if (card.card_type === 'slideshow') {
          return <SlideshowCard key={card.id} card={card} />
        }

        if (card.card_type === 'video') {
          return <VideoCard key={card.id} card={card} />
        }

        switch (card.built_in_section_key) {
          case 'about':
            return (
              <AboutBuiltInCard
                key={card.id}
                card={card}
                aboutEventHtml={aboutEventHtml}
              />
            )
          case 'event_details':
            return (
              <EventDetailsBuiltInCard
                key={card.id}
                card={card}
                event={event}
                currentEventForSwitcher={currentEventForSwitcher}
              />
            )
          case 'sponsors':
            return (
              <SponsorsBuiltInCard
                key={card.id}
                card={card}
                eventId={eventId}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
