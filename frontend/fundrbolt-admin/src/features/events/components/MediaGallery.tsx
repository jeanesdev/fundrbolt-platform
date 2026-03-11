/**
 * MediaGallery
 * Display and manage auction item media with drag-and-drop reordering
 */
import { useEffect, useState } from 'react'
import type { AuctionItemMedia } from '@/types/auction-item'
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Star,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MediaGalleryProps {
  media: AuctionItemMedia[]
  onReorder: (mediaIds: string[]) => Promise<void>
  onDelete: (mediaId: string) => Promise<void>
  onSetPrimary?: (mediaId: string) => void
  readOnly?: boolean
}

interface SortableMediaItemProps {
  media: AuctionItemMedia
  isPrimary: boolean
  onDelete: (mediaId: string) => void
  onSetPrimary?: (mediaId: string) => void
  onView: (media: AuctionItemMedia) => void
  readOnly?: boolean
}

function SortableMediaItem({
  media,
  isPrimary,
  onDelete,
  onSetPrimary,
  onView,
  readOnly = false,
}: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id, disabled: readOnly })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isImage = media.media_type === 'image'
  const displayUrl = isImage
    ? media.thumbnail_path || media.file_path
    : media.file_path

  return (
    <div ref={setNodeRef} style={style} className='group relative'>
      <Card className='overflow-hidden'>
        {/* Media Display - Clickable */}
        <div
          className='bg-muted relative aspect-square cursor-pointer'
          onClick={() => onView(media)}
        >
          {isImage ? (
            <img
              src={displayUrl}
              alt={media.file_name}
              className='h-full w-full object-cover'
            />
          ) : (
            <video
              src={displayUrl}
              className='h-full w-full object-cover'
              controls={false}
            />
          )}

          {/* Drag Handle */}
          {!readOnly && (
            <div
              {...attributes}
              {...listeners}
              className='bg-background/80 absolute top-2 left-2 z-10 cursor-grab touch-none rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing'
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
            >
              <GripVertical className='h-4 w-4' />
            </div>
          )}

          {/* Primary Badge */}
          {isPrimary && (
            <div className='bg-primary text-primary-foreground absolute top-2 right-2 flex items-center gap-1 rounded p-1 text-xs font-medium'>
              <Star className='h-3 w-3 fill-current' />
              <span className='hidden sm:inline'>Primary</span>
            </div>
          )}

          {/* Set Primary Button - Only show on hover if not already primary */}
          {!readOnly && onSetPrimary && !isPrimary && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100'>
              <Button
                type='button'
                size='sm'
                variant='secondary'
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onSetPrimary(media.id)
                }}
                title='Set as primary image'
              >
                <Star className='mr-1 h-4 w-4' />
                Set Primary
              </Button>
            </div>
          )}
        </div>

        {/* File Info and Delete Button */}
        <div className='space-y-2 p-2'>
          <div>
            <p
              className='text-muted-foreground truncate text-xs'
              title={media.file_name}
            >
              {media.file_name}
            </p>
            <p className='text-muted-foreground text-xs'>
              {(media.file_size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>

          {/* Delete Button at Bottom */}
          {!readOnly && (
            <Button
              type='button'
              size='sm'
              variant='destructive'
              className='h-8 w-full'
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onDelete(media.id)
              }}
            >
              <Trash2 className='mr-1 h-3 w-3' />
              Delete
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

export function MediaGallery({
  media,
  onReorder,
  onDelete,
  onSetPrimary,
  readOnly = false,
}: MediaGalleryProps) {
  const [items, setItems] = useState(media)
  const [isReordering, setIsReordering] = useState(false)
  const [viewMedia, setViewMedia] = useState<AuctionItemMedia | null>(null)

  // Update items when media prop changes
  useEffect(() => {
    setItems(media)
  }, [media])

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 15, // Increased from 8 to prevent accidental text selection
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistically update the UI
    const newItems = arrayMove(items, oldIndex, newIndex)
    setItems(newItems)
    setIsReordering(true)

    try {
      // Send new order to backend
      await onReorder(newItems.map((item) => item.id))
    } catch {
      // Revert on error
      setItems(media)
    } finally {
      setIsReordering(false)
    }
  }

  const handleDelete = async (mediaId: string) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) {
      return
    }

    try {
      await onDelete(mediaId)
    } catch {
      // Error deleting media
    }
  }

  const handleNextMedia = () => {
    if (!viewMedia) return
    const currentIndex = items.findIndex((item) => item.id === viewMedia.id)
    const nextIndex = (currentIndex + 1) % items.length
    setViewMedia(items[nextIndex])
  }

  const handlePrevMedia = () => {
    if (!viewMedia) return
    const currentIndex = items.findIndex((item) => item.id === viewMedia.id)
    const prevIndex = (currentIndex - 1 + items.length) % items.length
    setViewMedia(items[prevIndex])
  }

  const getCurrentMediaIndex = () => {
    if (!viewMedia) return { current: 0, total: 0 }
    const currentIndex = items.findIndex((item) => item.id === viewMedia.id)
    return { current: currentIndex + 1, total: items.length }
  }

  // Primary image is the first item (display_order = 0)
  const primaryMediaId = items.length > 0 ? items[0].id : null

  if (items.length === 0) {
    return (
      <Card className='text-muted-foreground p-8 text-center'>
        <p>No media uploaded yet</p>
        <p className='mt-1 text-sm'>
          Upload images and videos to showcase this item
        </p>
      </Card>
    )
  }

  return (
    <div className='space-y-4'>
      {isReordering && (
        <div className='text-muted-foreground text-sm'>Saving new order...</div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4'>
            {items.map((mediaItem) => (
              <SortableMediaItem
                key={mediaItem.id}
                media={mediaItem}
                isPrimary={mediaItem.id === primaryMediaId}
                onDelete={handleDelete}
                onSetPrimary={onSetPrimary}
                onView={setViewMedia}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <p className='text-muted-foreground text-xs'>
          <strong>Tip:</strong> Drag items to reorder. The first image will be
          used as the primary thumbnail.
        </p>
      )}

      {/* Full-Size Media Modal */}
      <Dialog
        open={!!viewMedia}
        onOpenChange={(open) => !open && setViewMedia(null)}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-hidden p-0'>
          {viewMedia && (
            <>
              <DialogHeader className='p-6 pb-0'>
                <div className='flex items-center justify-between'>
                  <DialogTitle>{viewMedia.file_name}</DialogTitle>
                  <span className='text-muted-foreground text-sm'>
                    {getCurrentMediaIndex().current} /{' '}
                    {getCurrentMediaIndex().total}
                  </span>
                </div>
              </DialogHeader>

              <div className='group relative'>
                {/* Media Display */}
                <div className='bg-muted flex max-h-[60vh] min-h-[400px] items-center justify-center'>
                  {viewMedia.media_type === 'image' ? (
                    <img
                      src={viewMedia.file_path}
                      alt={viewMedia.file_name}
                      className='max-h-[60vh] max-w-full object-contain'
                    />
                  ) : (
                    <video
                      src={viewMedia.file_path}
                      className='max-h-[60vh] max-w-full'
                      controls
                    />
                  )}
                </div>

                {/* Navigation Buttons */}
                {items.length > 1 && (
                  <>
                    <Button
                      variant='secondary'
                      size='icon'
                      className='absolute top-1/2 left-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100'
                      onClick={handlePrevMedia}
                    >
                      <ChevronLeft className='h-6 w-6' />
                    </Button>
                    <Button
                      variant='secondary'
                      size='icon'
                      className='absolute top-1/2 right-4 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100'
                      onClick={handleNextMedia}
                    >
                      <ChevronRight className='h-6 w-6' />
                    </Button>
                  </>
                )}
              </div>

              {/* File Details */}
              <div className='text-muted-foreground space-y-1 p-6 pt-4 text-sm'>
                <p>
                  <strong>File:</strong> {viewMedia.file_name}
                </p>
                <p>
                  <strong>Size:</strong>{' '}
                  {(viewMedia.file_size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <p>
                  <strong>Type:</strong> {viewMedia.media_type}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
