import { useEffect, useState } from 'react'
import {
  type CausePageConfig,
  type CauseSectionCard,
  type ColorToken,
  type ConflictResponse,
  updateCausePageCard,
} from '@/services/cause-section-cards'
import type { EventMedia } from '@/types/event'
import { toast } from 'sonner'
import { getErrorMessage, isErrorStatus } from '@/lib/error-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { SlideshowCardEditor } from './SlideshowCardEditor'
import { TextCardEditor } from './TextCardEditor'
import { VideoCardEditor } from './VideoCardEditor'

const COLOR_OPTIONS: Array<{ label: string; value: ColorToken | null }> = [
  { label: 'Default', value: null },
  { label: 'Slate 50', value: 'slate-50' },
  { label: 'Slate 100', value: 'slate-100' },
  { label: 'Slate 200', value: 'slate-200' },
  { label: 'White', value: 'white' },
  { label: 'None', value: 'transparent' },
]

function builtInLabel(card: CauseSectionCard) {
  if (!card.built_in_section_key) return null
  return card.built_in_section_key.replace(/_/g, ' ')
}

interface CardEditorProps {
  eventId: string
  eventMedia: EventMedia[]
  card: CauseSectionCard | null
  config: CausePageConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConflict: (
    detail: ConflictResponse,
    retry: (draftVersion: number) => Promise<void>
  ) => void
  onCardReplaced: (card: CauseSectionCard) => void
  onRefresh: () => Promise<void>
}

export function CardEditor({
  eventId,
  eventMedia,
  card,
  config,
  open,
  onOpenChange,
  onConflict,
  onCardReplaced,
  onRefresh,
}: CardEditorProps) {
  const [title, setTitle] = useState('')
  const [showHeader, setShowHeader] = useState(false)
  const [isCollapsible, setIsCollapsible] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [backgroundColorToken, setBackgroundColorToken] =
    useState<ColorToken | null>(null)
  const [borderColorToken, setBorderColorToken] = useState<ColorToken | null>(
    null
  )
  const [contentHtml, setContentHtml] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoMediaSource, setVideoMediaSource] = useState<
    'upload' | 'external' | null
  >('external')
  const [videoAutoplay, setVideoAutoplay] = useState(false)
  const [videoMutedByDefault, setVideoMutedByDefault] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!card) return
    setTitle(card.title ?? '')
    setShowHeader(card.show_header)
    setIsCollapsible(card.is_collapsible)
    setIsEnabled(card.is_enabled)
    setBackgroundColorToken(card.background_color_token)
    setBorderColorToken(card.border_color_token)
    setContentHtml(card.content_html ?? '')
    setVideoUrl(card.video_url ?? '')
    setVideoMediaSource(card.video_media_source ?? 'external')
    setVideoAutoplay(card.video_autoplay ?? false)
    setVideoMutedByDefault(card.video_muted_by_default ?? true)
  }, [card])

  if (!card || !config) return null

  const handleSave = async (versionOverride?: number) => {
    setIsSaving(true)
    try {
      const saved = await updateCausePageCard(eventId, card.id, {
        draft_version: versionOverride ?? config.draft_version,
        title: title || null,
        show_header: showHeader,
        is_collapsible: isCollapsible,
        is_enabled: isEnabled,
        background_color_token: backgroundColorToken,
        border_color_token: borderColorToken,
        content_html:
          card.card_type === 'text' ? contentHtml || null : undefined,
        video_url: card.card_type === 'video' ? videoUrl || null : undefined,
        video_media_source:
          card.card_type === 'video' ? videoMediaSource : undefined,
        video_autoplay: card.card_type === 'video' ? videoAutoplay : undefined,
        video_muted_by_default:
          card.card_type === 'video' ? videoMutedByDefault : undefined,
      })
      onCardReplaced(saved)
      await onRefresh()
      onOpenChange(false)
      toast.success('Card saved')
    } catch (error) {
      if (isErrorStatus(error, 409)) {
        const detail = (
          error as { response?: { data?: { detail?: ConflictResponse } } }
        ).response?.data?.detail
        if (detail) {
          onConflict(detail, handleSave)
          return
        }
      }
      toast.error(getErrorMessage(error, 'Unable to save card'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='w-full sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>Configure Cause Card</SheetTitle>
          <SheetDescription>
            Fine-tune content, order, styling, and publish-ready presentation.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='min-h-0 flex-1 px-4'>
          <div className='space-y-6 pb-6'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Card Type</Label>
                <div className='flex h-10 items-center rounded-md border px-3 text-sm capitalize'>
                  {card.card_type.replace(/_/g, ' ')}
                </div>
              </div>
              {card.card_type === 'built_in' && (
                <div className='space-y-2'>
                  <Label>Built-in Section</Label>
                  <div className='flex h-10 items-center rounded-md border px-3 text-sm capitalize'>
                    {builtInLabel(card)}
                  </div>
                </div>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='card-title'>Card Title</Label>
              <Input
                id='card-title'
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder='Optional section title'
              />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <div>
                  <p className='font-medium'>Show Header</p>
                  <p className='text-muted-foreground text-sm'>
                    Display the title above card content.
                  </p>
                </div>
                <Switch checked={showHeader} onCheckedChange={setShowHeader} />
              </div>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <div>
                  <p className='font-medium'>Collapsible</p>
                  <p className='text-muted-foreground text-sm'>
                    Allow donors to expand or collapse this section.
                  </p>
                </div>
                <Switch
                  checked={isCollapsible}
                  onCheckedChange={setIsCollapsible}
                />
              </div>
            </div>

            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <p className='font-medium'>Enabled</p>
                <p className='text-muted-foreground text-sm'>
                  Disabled cards stay in draft but are hidden after publish.
                </p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Background</Label>
                <Select
                  value={backgroundColorToken ?? 'default'}
                  onValueChange={(value) =>
                    setBackgroundColorToken(
                      value === 'default' ? null : (value as ColorToken)
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value ?? 'default'}
                        value={option.value ?? 'default'}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Border</Label>
                <Select
                  value={borderColorToken ?? 'default'}
                  onValueChange={(value) =>
                    setBorderColorToken(
                      value === 'default' ? null : (value as ColorToken)
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value ?? 'default'}
                        value={option.value ?? 'default'}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {card.card_type === 'text' && (
              <TextCardEditor
                contentHtml={contentHtml}
                onChange={setContentHtml}
              />
            )}

            {card.card_type === 'video' && (
              <VideoCardEditor
                videoUrl={videoUrl}
                videoMediaSource={videoMediaSource}
                videoAutoplay={videoAutoplay}
                videoMutedByDefault={videoMutedByDefault}
                onVideoUrlChange={setVideoUrl}
                onVideoMediaSourceChange={setVideoMediaSource}
                onVideoAutoplayChange={setVideoAutoplay}
                onVideoMutedByDefaultChange={setVideoMutedByDefault}
              />
            )}

            {card.card_type === 'slideshow' && (
              <SlideshowCardEditor
                eventId={eventId}
                card={card}
                eventMedia={eventMedia}
                draftVersion={config.draft_version}
                onConflict={onConflict}
                onCardReplaced={onCardReplaced}
                onRefresh={onRefresh}
              />
            )}

            {card.card_type === 'built_in' && (
              <div className='rounded-lg border p-4'>
                <div className='mb-2 flex items-center gap-2'>
                  <Badge variant='secondary'>Built-in</Badge>
                  <span className='text-sm capitalize'>
                    {builtInLabel(card)}
                  </span>
                </div>
                <p className='text-muted-foreground text-sm'>
                  Built-in sections use existing donor components. You can still
                  change order, enablement, and style.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type='button'
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            Save Draft
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
