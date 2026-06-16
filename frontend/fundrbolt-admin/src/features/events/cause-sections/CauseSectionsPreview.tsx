import type { CauseSectionCard } from '@/services/cause-section-cards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const backgroundTokenClass: Record<string, string> = {
  'slate-50': 'bg-slate-50',
  'slate-100': 'bg-slate-100',
  'slate-200': 'bg-slate-200',
  white: 'bg-white',
  transparent: 'bg-transparent',
}

const borderTokenClass: Record<string, string> = {
  'slate-50': 'border-slate-50',
  'slate-100': 'border-slate-100',
  'slate-200': 'border-slate-200',
  white: 'border-white',
  transparent: 'border-transparent',
}

function cardClasses(card: CauseSectionCard) {
  return [
    'rounded-2xl border p-4 shadow-sm',
    backgroundTokenClass[card.background_color_token ?? 'white'] ?? 'bg-white',
    borderTokenClass[card.border_color_token ?? 'slate-200'] ??
      'border-slate-200',
  ].join(' ')
}

export function CauseSectionsPreview({
  cards,
  eventDescription,
}: {
  cards: CauseSectionCard[]
  eventDescription: string | null | undefined
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Donor Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4 rounded-2xl bg-slate-100 p-4'>
          {cards
            .filter((card) => card.is_enabled)
            .sort((a, b) => a.display_order - b.display_order)
            .map((card) => (
              <div key={card.id} className={cardClasses(card)}>
                {card.show_header && card.title && (
                  <h3 className='mb-3 text-sm font-semibold tracking-wide uppercase'>
                    {card.title}
                  </h3>
                )}

                {card.card_type === 'text' && (
                  <div
                    className='prose prose-sm max-w-none'
                    dangerouslySetInnerHTML={{
                      __html: card.content_html ?? '',
                    }}
                  />
                )}

                {card.card_type === 'slideshow' && (
                  <div className='space-y-3'>
                    {card.slides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className='rounded-xl border bg-white p-3'
                      >
                        <p className='text-xs font-medium tracking-wide uppercase'>
                          Slide {index + 1}
                        </p>
                        {slide.media_url && (
                          <img
                            src={slide.media_url}
                            alt={slide.alt_text ?? 'Slide media'}
                            className='mt-2 h-40 w-full rounded-lg object-cover'
                          />
                        )}
                        {slide.overlay_html && (
                          <div
                            className='prose prose-sm mt-3 max-w-none'
                            dangerouslySetInnerHTML={{
                              __html: slide.overlay_html,
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {card.card_type === 'video' && (
                  <div className='space-y-2 text-sm'>
                    <p className='font-medium'>Video URL</p>
                    <p className='text-muted-foreground break-all'>
                      {card.video_url ?? 'No video configured'}
                    </p>
                  </div>
                )}

                {card.card_type === 'built_in' && (
                  <div className='text-muted-foreground text-sm'>
                    {card.built_in_section_key === 'about' &&
                      'About This Event will render here using the donor experience layout.'}
                    {card.built_in_section_key === 'sponsors' &&
                      'Sponsors carousel will render here using published sponsor data.'}
                    {card.built_in_section_key === 'event_details' &&
                      'Event details accordion will render here using current event details.'}
                    {card.built_in_section_key === 'about' &&
                      eventDescription && (
                        <div
                          className='prose prose-sm mt-3 max-w-none'
                          dangerouslySetInnerHTML={{ __html: eventDescription }}
                        />
                      )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
