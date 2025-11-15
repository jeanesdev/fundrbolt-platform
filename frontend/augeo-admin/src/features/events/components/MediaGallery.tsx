/**
 * MediaGallery
 * Display and manage auction item media with drag-and-drop reordering
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AuctionItemMedia } from '@/types/auction-item';
import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MediaGalleryProps {
  media: AuctionItemMedia[];
  onReorder: (mediaIds: string[]) => Promise<void>;
  onDelete: (mediaId: string) => Promise<void>;
  onSetPrimary?: (mediaId: string) => void;
  readOnly?: boolean;
}

interface SortableMediaItemProps {
  media: AuctionItemMedia;
  isPrimary: boolean;
  onDelete: (mediaId: string) => void;
  onSetPrimary?: (mediaId: string) => void;
  readOnly?: boolean;
}

function SortableMediaItem({
  media,
  isPrimary,
  onDelete,
  onSetPrimary,
  readOnly = false,
}: SortableMediaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: media.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isImage = media.media_type === 'image';
  const displayUrl = isImage ? (media.thumbnail_path || media.file_path) : media.file_path;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Card className="overflow-hidden">
        {/* Media Display */}
        <div className="aspect-square bg-muted relative">
          {isImage ? (
            <img
              src={displayUrl}
              alt={media.file_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={displayUrl}
              className="w-full h-full object-cover"
              controls={false}
            />
          )}

          {/* Drag Handle */}
          {!readOnly && (
            <div
              {...attributes}
              {...listeners}
              className="absolute top-2 left-2 p-1 bg-background/80 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none z-10"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {/* Primary Badge */}
          {isPrimary && (
            <div className="absolute top-2 right-2 p-1 bg-primary rounded flex items-center gap-1 text-primary-foreground text-xs font-medium">
              <Star className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">Primary</span>
            </div>
          )}

          {/* Actions Overlay */}
          {!readOnly && (
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onSetPrimary && !isPrimary && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onSetPrimary(media.id);
                  }}
                  title="Set as primary image"
                >
                  <Star className="w-4 h-4" />
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onDelete(media.id);
                }}
                title="Delete media"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="p-2">
          <p className="text-xs text-muted-foreground truncate" title={media.file_name}>
            {media.file_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {(media.file_size / (1024 * 1024)).toFixed(1)} MB
          </p>
        </div>
      </Card>
    </div>
  );
}

export function MediaGallery({
  media,
  onReorder,
  onDelete,
  onSetPrimary,
  readOnly = false,
}: MediaGalleryProps) {
  const [items, setItems] = useState(media);
  const [isReordering, setIsReordering] = useState(false);

  // Update items when media prop changes
  useEffect(() => {
    setItems(media);
  }, [media]);

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
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update the UI
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    setIsReordering(true);

    try {
      // Send new order to backend
      await onReorder(newItems.map((item) => item.id));
    } catch {
      // Revert on error
      setItems(media);
    } finally {
      setIsReordering(false);
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) {
      return;
    }

    try {
      await onDelete(mediaId);
    } catch {
      // Error deleting media
    }
  };

  // Primary image is the first item (display_order = 0)
  const primaryMediaId = items.length > 0 ? items[0].id : null;

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>No media uploaded yet</p>
        <p className="text-sm mt-1">Upload images and videos to showcase this item</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isReordering && (
        <div className="text-sm text-muted-foreground">
          Saving new order...
        </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((mediaItem) => (
              <SortableMediaItem
                key={mediaItem.id}
                media={mediaItem}
                isPrimary={mediaItem.id === primaryMediaId}
                onDelete={handleDelete}
                onSetPrimary={onSetPrimary}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Drag items to reorder. The first image will be used as the primary thumbnail.
        </p>
      )}
    </div>
  );
}
