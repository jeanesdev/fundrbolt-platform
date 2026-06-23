import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  EventMedia,
  EventMediaUsageTag,
  HeroTransitionStyle,
} from '@/types/event'
import { ImageIcon, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { MediaUploader } from '../components/MediaUploader'
import { useEventWorkspace } from '../useEventWorkspace'

const transitionOptions: Array<{ value: HeroTransitionStyle; label: string }> =
  [
    { value: 'documentary_style', label: 'Documentary style' },
    { value: 'fade', label: 'Fade' },
    { value: 'swipe', label: 'Swipe' },
    { value: 'simple', label: 'Simple' },
  ]

const documentaryKeyframes = [
  'heroKenBurnsA',
  'heroKenBurnsB',
  'heroKenBurnsC',
  'heroKenBurnsD',
] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function HeroTransitionDemo({
  open,
  onOpenChange,
  images,
  transitionStyle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: EventMedia[]
  transitionStyle: HeroTransitionStyle
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open || images.length <= 1) {
      return
    }

    const intervalByStyle: Record<HeroTransitionStyle, number> = {
      documentary_style: 7000,
      fade: 5000,
      swipe: 5000,
      simple: 4000,
    }

    const intervalId = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length)
    }, intervalByStyle[transitionStyle])

    return () => {
      window.clearInterval(intervalId)
    }
  }, [images.length, open, transitionStyle])

  const getDocumentaryMotionStyle = (image: EventMedia, isActive: boolean) => {
    const seed = hashString(`${image.id}:${transitionStyle}`)
    const keyframe = documentaryKeyframes[seed % documentaryKeyframes.length]
    const animationDuration = `${7.2 + (seed % 4) * 0.45}s`
    const offsetX = 48 + (seed % 5)
    const offsetY = 48 + ((seed >> 3) % 5)
    const brightness = 0.97 + (seed % 5) * 0.015
    const saturate = 0.98 + ((seed >> 2) % 5) * 0.03
    const contrast = 0.98 + ((seed >> 4) % 4) * 0.02

    return {
      opacity: isActive ? 1 : 0,
      transform: 'scale(1.03)',
      transition: 'opacity 900ms ease',
      animation: `${keyframe} ${animationDuration} ease-in-out infinite alternate`,
      backgroundPosition: `${offsetX}% ${offsetY}%`,
      filter: `brightness(${brightness}) saturate(${saturate}) contrast(${contrast})`,
    }
  }

  const getSlideStyle = (position: number, image: EventMedia) => {
    const isActive = position === index
    const duration = transitionStyle === 'simple' ? '400ms' : '900ms'

    if (transitionStyle === 'swipe') {
      const distance =
        images.length > 0
          ? (position - index + images.length) % images.length
          : 0
      const swipeOffset = distance === 1 ? '10%' : '-10%'
      return {
        opacity: isActive ? 1 : 0,
        transform: isActive
          ? 'translateX(0%) scale(1.02)'
          : `translateX(${swipeOffset}) scale(1.02)`,
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

    return getDocumentaryMotionStyle(image, isActive)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Hero Transition Demo</DialogTitle>
        </DialogHeader>
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
        <div className='bg-muted relative h-56 w-full overflow-hidden rounded-lg'>
          {images.length > 0 ? (
            images.map((image, position) => (
              <div
                key={image.id}
                className='absolute inset-0 bg-cover bg-center will-change-transform'
                style={{
                  backgroundImage: `url(${image.file_url})`,
                  ...getSlideStyle(position, image),
                }}
              />
            ))
          ) : (
            <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
              Upload at least one Main Event Page Hero image to preview
              transitions.
            </div>
          )}
          <div className='absolute inset-0 bg-gradient-to-b from-black/20 to-black/60' />
          <div className='absolute bottom-3 left-3 text-sm font-semibold text-white'>
            {
              transitionOptions.find(
                (option) => option.value === transitionStyle
              )?.label
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const singleImageUsageRows = [
  { usageTag: 'event_logo_icon', label: 'Event Logo Icon (Square)' },
  { usageTag: 'event_logo', label: 'Event Logo Full' },
  { usageTag: 'npo_logo_icon', label: 'NPO Logo Icon (Square)' },
  { usageTag: 'npo_logo', label: 'NPO Logo Full' },
  { usageTag: 'event_layout_map', label: 'Event Map Layout' },
] as const

export function EventMediaSection() {
  const {
    eventId,
    currentEvent,
    handleMediaUpload,
    handleMediaUpdate,
    handleMediaDelete,
    uploadProgress,
    uploadingFiles,
    updateEvent,
  } = useEventWorkspace()

  const heroMedia = useMemo(
    () =>
      (currentEvent.media || [])
        .filter((item) => item.usage_tag === 'main_event_page_hero')
        .sort((a, b) => a.display_order - b.display_order),
    [currentEvent.media]
  )

  const [heroTransitionStyle, setHeroTransitionStyle] =
    useState<HeroTransitionStyle>(
      currentEvent.hero_transition_style ?? 'documentary_style'
    )
  const [savingStyle, setSavingStyle] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [uploadingUsageTag, setUploadingUsageTag] =
    useState<EventMediaUsageTag | null>(null)
  const demoKey = useMemo(
    () =>
      `${showDemo}:${heroTransitionStyle}:${heroMedia
        .map((item) => `${item.id}:${item.file_url}`)
        .join('|')}`,
    [heroMedia, heroTransitionStyle, showDemo]
  )

  useEffect(() => {
    setHeroTransitionStyle(
      currentEvent.hero_transition_style ?? 'documentary_style'
    )
  }, [currentEvent.hero_transition_style])

  const handleTransitionStyleChange = async (value: HeroTransitionStyle) => {
    setHeroTransitionStyle(value)
    setSavingStyle(true)

    try {
      await updateEvent(currentEvent.id || eventId, {
        hero_transition_style: value,
      })
      toast.success('Hero transition style updated')
    } catch (_error) {
      setHeroTransitionStyle(
        currentEvent.hero_transition_style ?? 'documentary_style'
      )
      toast.error('Failed to update hero transition style')
    } finally {
      setSavingStyle(false)
    }
  }

  const getCurrentSingleImage = (usageTag: EventMediaUsageTag) => {
    const matches = (currentEvent.media || [])
      .filter((item) => item.usage_tag === usageTag)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return {
      current: matches[0],
      extraCount: Math.max(0, matches.length - 1),
      all: matches,
    }
  }

  const handleSingleImageUpload = async (
    usageTag: EventMediaUsageTag,
    file?: File
  ) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }

    setUploadingUsageTag(usageTag)

    try {
      const existing = (currentEvent.media || []).filter(
        (item) => item.usage_tag === usageTag
      )

      for (const media of existing) {
        await handleMediaDelete(media.id)
      }

      await handleMediaUpload(file, usageTag)
      toast.success('Image uploaded')
    } catch (_error) {
      toast.error('Failed to upload image')
    } finally {
      setUploadingUsageTag(null)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Main Event Page Hero Images</CardTitle>
          <CardDescription>
            Manage slideshow images shown at the top of the Donor PWA event home
            page.
          </CardDescription>
          <div className='flex flex-col gap-3 pt-2 sm:flex-row sm:items-center'>
            <div className='w-full sm:w-64'>
              <Select
                value={heroTransitionStyle}
                onValueChange={(value) =>
                  void handleTransitionStyleChange(value as HeroTransitionStyle)
                }
                disabled={savingStyle}
              >
                <SelectTrigger>
                  <SelectValue placeholder='Select transition type' />
                </SelectTrigger>
                <SelectContent>
                  {transitionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowDemo(true)}
            >
              Demo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MediaUploader
            media={heroMedia}
            onUpload={handleMediaUpload}
            onUpdateMedia={handleMediaUpdate}
            onDelete={handleMediaDelete}
            usageTagFilter='main_event_page_hero'
            defaultUploadUsageTag='main_event_page_hero'
            showUsageTagSelector={false}
            uploadProgress={uploadProgress}
            uploadingFiles={uploadingFiles}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Logos and Map</CardTitle>
          <CardDescription>
            Upload one image for each usage type. Uploading a new file replaces
            the existing one for that slot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {singleImageUsageRows.map((row) => {
              const { current, extraCount } = getCurrentSingleImage(
                row.usageTag
              )
              const inputId = `single-media-${row.usageTag}`
              const isUploading = uploadingUsageTag === row.usageTag

              return (
                <div
                  key={row.usageTag}
                  className='flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between'
                >
                  <div className='flex items-center gap-3'>
                    {current?.file_url ? (
                      <img
                        src={current.file_url}
                        alt={row.label}
                        className='h-16 w-16 rounded border object-cover'
                      />
                    ) : (
                      <div className='bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded border'>
                        <ImageIcon className='h-5 w-5' />
                      </div>
                    )}

                    <div>
                      <p className='text-sm font-medium'>{row.label}</p>
                      <p className='text-muted-foreground text-xs'>
                        {current ? current.file_name : 'No image uploaded'}
                      </p>
                      {extraCount > 0 && (
                        <p className='text-xs text-amber-600'>
                          {extraCount} older image
                          {extraCount === 1 ? '' : 's'} will be removed on next
                          upload.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    <input
                      id={inputId}
                      type='file'
                      accept='image/jpeg,image/png,image/webp,image/gif'
                      className='hidden'
                      onChange={(event) => {
                        void handleSingleImageUpload(
                          row.usageTag,
                          event.target.files?.[0]
                        )
                        event.currentTarget.value = ''
                      }}
                    />
                    <Button type='button' variant='outline' asChild>
                      <label htmlFor={inputId} className='cursor-pointer'>
                        {isUploading ? (
                          <span className='inline-flex items-center gap-2'>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            Uploading...
                          </span>
                        ) : (
                          'Choose File'
                        )}
                      </label>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <HeroTransitionDemo
        key={demoKey}
        open={showDemo}
        onOpenChange={setShowDemo}
        images={heroMedia}
        transitionStyle={heroTransitionStyle}
      />
    </div>
  )
}
