import { useEffect, useMemo, useState } from 'react'
import {
  createCardSlide,
  deleteCardSlide,
  reorderCardSlides,
  updateCardSlide,
  type CauseSectionCard,
  type ConflictResponse,
  type CreateSlideRequest,
  type MediaSource,
  type SlideItem,
  type SlideReorderRequest,
  type SlideVariant,
  type UpdateSlideRequest,
} from '@/services/cause-section-cards'
import type { EventMedia } from '@/types/event'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage, isErrorStatus } from '@/lib/error-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SlideshowCardEditorProps {
  eventId: string
  card: CauseSectionCard
  eventMedia: EventMedia[]
  draftVersion: number
  onConflict: (
    detail: ConflictResponse,
    retry: (draftVersion: number) => Promise<void>
  ) => void
  onCardReplaced: (card: CauseSectionCard) => void
  onRefresh: () => Promise<void>
}

interface SlideDraft {
  slide_variant: SlideVariant
  media_url: string
  media_source: MediaSource
  slide_name: string
  alt_text: string
  overlay_html: string
}

function toDraft(slide?: SlideItem): SlideDraft {
  return {
    slide_variant: slide?.slide_variant ?? 'image_only',
    media_url: slide?.media_url ?? '',
    media_source: slide?.media_source ?? 'external',
    slide_name: slide?.slide_name ?? '',
    alt_text: slide?.alt_text ?? '',
    overlay_html: slide?.overlay_html ?? '',
  }
}

export function SlideshowCardEditor({
  eventId,
  card,
  eventMedia,
  draftVersion,
  onConflict,
  onCardReplaced,
  onRefresh,
}: SlideshowCardEditorProps) {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(
    card.slides[0]?.id ?? null
  )
  const [activeSlideOrder, setActiveSlideOrder] = useState<number | null>(
    card.slides[0]?.display_order ?? null
  )
  const [draft, setDraft] = useState<SlideDraft>(toDraft(card.slides[0]))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const active = card.slides.find((slide) => slide.id === activeSlideId)
    const byOrder =
      activeSlideOrder === null
        ? null
        : card.slides.find((slide) => slide.display_order === activeSlideOrder)
    const nextSlide = active ?? byOrder ?? card.slides[0]
    setActiveSlideId(nextSlide?.id ?? null)
    setActiveSlideOrder(nextSlide?.display_order ?? null)
    setDraft(toDraft(nextSlide))
  }, [activeSlideId, activeSlideOrder, card.slides])

  const activeSlide = useMemo(
    () => card.slides.find((slide) => slide.id === activeSlideId) ?? null,
    [activeSlideId, card.slides]
  )

  const uploadedImageAssets = useMemo(
    () =>
      eventMedia
        .filter(
          (media) =>
            media.media_type === 'image' ||
            media.mime_type?.toLowerCase().startsWith('image/')
        )
        .sort((a, b) => a.display_order - b.display_order),
    [eventMedia]
  )

  const handleError = (
    error: unknown,
    retry: (draftVersion: number) => Promise<void>
  ) => {
    if (isErrorStatus(error, 409)) {
      const detail = (
        error as { response?: { data?: { detail?: ConflictResponse } } }
      ).response?.data?.detail
      if (detail) {
        onConflict(detail, retry)
        return
      }
    }
    toast.error(getErrorMessage(error, 'Unable to save slide changes'))
  }

  const handleAddSlide = async (versionOverride?: number): Promise<void> => {
    setIsSaving(true)
    const payload: CreateSlideRequest = {
      draft_version: versionOverride ?? draftVersion,
      slide_variant: 'image_only',
      media_url: 'https://example.com/image.jpg',
      media_source: 'external',
      slide_name: null,
      alt_text: 'Describe this slide',
      overlay_html: '',
    }

    try {
      const created = await createCardSlide(eventId, card.id, payload)
      await onRefresh()
      onCardReplaced({ ...card, id: created.card_id })
      setActiveSlideId(created.id)
      setActiveSlideOrder(created.display_order)
      setDraft(toDraft(created))
      toast.success('Slide added')
    } catch (error) {
      handleError(error, handleAddSlide)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSlide = async (versionOverride?: number) => {
    if (!activeSlide) return
    setIsSaving(true)
    const payload: UpdateSlideRequest = {
      draft_version: versionOverride ?? draftVersion,
      slide_variant: draft.slide_variant,
      media_url: draft.media_url || null,
      media_source: draft.media_source,
      slide_name: draft.slide_name || null,
      alt_text: draft.alt_text || null,
      overlay_html: draft.overlay_html || null,
    }

    try {
      const updated = await updateCardSlide(
        eventId,
        card.id,
        activeSlide.id,
        payload
      )
      onCardReplaced({ ...card, id: updated.card_id })
      await onRefresh()
      setActiveSlideId(updated.id)
      setActiveSlideOrder(updated.display_order)
      toast.success('Slide saved')
    } catch (error) {
      handleError(error, handleSaveSlide)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSlide = async (
    slide: SlideItem,
    versionOverride?: number
  ) => {
    setIsSaving(true)
    try {
      await deleteCardSlide(eventId, card.id, slide.id, {
        draft_version: versionOverride ?? draftVersion,
      })
      await onRefresh()
      toast.success('Slide deleted')
    } catch (error) {
      handleError(error, (nextVersion) => handleDeleteSlide(slide, nextVersion))
    } finally {
      setIsSaving(false)
    }
  }

  const handleReorderSlides = async (
    slideIds: string[],
    versionOverride?: number
  ) => {
    setIsSaving(true)
    const payload: SlideReorderRequest = {
      draft_version: versionOverride ?? draftVersion,
      slide_ids: slideIds,
    }

    try {
      const reordered = await reorderCardSlides(eventId, card.id, payload)
      onCardReplaced({ ...card, id: reordered[0]?.card_id ?? card.id })
      await onRefresh()
      toast.success('Slide order updated')
    } catch (error) {
      handleError(error, (nextVersion) =>
        handleReorderSlides(slideIds, nextVersion)
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <p className='font-medium'>Slides</p>
          <p className='text-muted-foreground text-sm'>
            Create and order donor-facing slides.
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={() => void handleAddSlide()}
        >
          <Plus className='mr-2 h-4 w-4' />
          Add slide
        </Button>
      </div>

      <div className='space-y-3'>
        {card.slides.map((slide, index) => (
          <Card
            key={slide.id}
            className={activeSlideId === slide.id ? 'ring-primary ring-2' : ''}
          >
            <CardContent className='flex flex-wrap items-center justify-between gap-3 p-4'>
              <button
                type='button'
                className='text-left'
                onClick={() => {
                  setActiveSlideId(slide.id)
                  setActiveSlideOrder(slide.display_order)
                  setDraft(toDraft(slide))
                }}
              >
                <p className='font-medium'>
                  {slide.slide_name?.trim() || `Slide ${index + 1}`}
                </p>
                <p className='text-muted-foreground text-sm'>
                  {slide.slide_variant.replace(/_/g, ' ')}
                </p>
              </button>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  disabled={index === 0}
                  onClick={() => {
                    const nextIds = [...card.slides]
                    ;[nextIds[index - 1], nextIds[index]] = [
                      nextIds[index],
                      nextIds[index - 1],
                    ]
                    void handleReorderSlides(nextIds.map((item) => item.id))
                  }}
                >
                  <ArrowUp className='h-4 w-4' />
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  disabled={index === card.slides.length - 1}
                  onClick={() => {
                    const nextIds = [...card.slides]
                    ;[nextIds[index], nextIds[index + 1]] = [
                      nextIds[index + 1],
                      nextIds[index],
                    ]
                    void handleReorderSlides(nextIds.map((item) => item.id))
                  }}
                >
                  <ArrowDown className='h-4 w-4' />
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => void handleDeleteSlide(slide)}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeSlide ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit slide</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-2'>
              <Label>Slide Name</Label>
              <Input
                value={draft.slide_name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slide_name: event.target.value,
                  }))
                }
                placeholder='Optional internal slide name'
              />
            </div>

            <div className='space-y-2'>
              <Label>Slide Variant</Label>
              <Select
                value={draft.slide_variant}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    slide_variant: value as SlideVariant,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='image_only'>Image Only</SelectItem>
                  <SelectItem value='text_over_image'>
                    Text Over Image
                  </SelectItem>
                  <SelectItem value='text_only'>Text Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.slide_variant !== 'text_only' && (
              <>
                <div className='space-y-2'>
                  <Label>Media Source</Label>
                  <Select
                    value={draft.media_source}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        media_source: value as MediaSource,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='external'>
                        External HTTPS URL
                      </SelectItem>
                      <SelectItem value='upload'>Uploaded Asset URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>Media URL</Label>
                  {draft.media_source === 'upload' ? (
                    <>
                      <Select
                        value={draft.media_url || undefined}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            media_url: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select an uploaded image' />
                        </SelectTrigger>
                        <SelectContent>
                          {uploadedImageAssets.map((media) => (
                            <SelectItem key={media.id} value={media.file_url}>
                              <div className='flex items-center gap-2'>
                                <img
                                  src={media.file_url}
                                  alt={media.file_name}
                                  className='h-8 w-8 rounded object-cover'
                                  loading='lazy'
                                />
                                <span className='truncate'>
                                  {media.file_name}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {uploadedImageAssets.length === 0 && (
                        <p className='text-muted-foreground text-xs'>
                          No uploaded images found for this event. Upload media
                          in Event Media first.
                        </p>
                      )}
                    </>
                  ) : (
                    <Input
                      value={draft.media_url}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          media_url: event.target.value,
                        }))
                      }
                      placeholder='https://...'
                    />
                  )}
                </div>
                <div className='space-y-2'>
                  <Label>Alt Text</Label>
                  <Input
                    value={draft.alt_text}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        alt_text: event.target.value,
                      }))
                    }
                    placeholder='Describe the image for screen readers'
                  />
                </div>
              </>
            )}

            <div className='space-y-2'>
              <Label>Overlay Copy</Label>
              <RichTextEditor
                value={draft.overlay_html}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    overlay_html: value,
                  }))
                }
                placeholder='Add optional headline or supporting copy...'
              />
            </div>

            <div className='flex justify-end'>
              <Button
                type='button'
                onClick={() => void handleSaveSlide()}
                disabled={isSaving}
              >
                <Save className='mr-2 h-4 w-4' />
                Save Slide
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='text-muted-foreground p-6 text-sm'>
            Add a slide to start building this slideshow.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
