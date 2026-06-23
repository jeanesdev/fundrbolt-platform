/**
 * EventRunOfShowPage — Full-page view of the run-of-show for an event.
 * Accessible via /events/:eventId/run-of-show
 */
import React, { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyRosTemplate,
  createRosItem,
  deleteRosItem,
  getRunOfShow,
  listRosTemplates,
  markRosItemComplete,
  markRosItemIncomplete,
  saveAsRosTemplate,
  updateRosItem,
} from '@/services/runOfShowService'
import type {
  RunOfShowItemCreate,
  RunOfShowItemUpdate,
  RunOfShowTemplate,
} from '@/types/run-of-show'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  CalendarClock,
  Clock,
  ListPlus,
  Loader2,
  Plus,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'
import { RunOfShowItemForm } from '../components/RunOfShowItemForm'
import { SortableRunOfShowItem } from '../components/SortableRunOfShowItem'

export function EventRunOfShowPage() {
  const { currentEvent } = useEventWorkspace()
  const eventId = currentEvent.id
  const queryClient = useQueryClient()

  const [showAddForm, setShowAddForm] = useState(false)
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false)
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )
  const [confirmReplace, setConfirmReplace] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ros', eventId],
    queryFn: () => getRunOfShow(eventId),
    refetchInterval: 30_000,
  })

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['ros-templates', currentEvent.npo_id],
    queryFn: () => listRosTemplates(currentEvent.npo_id!),
    enabled: showApplyTemplateDialog && !!currentEvent.npo_id,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const items = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          new Date(a.scheduled_time).getTime() -
          new Date(b.scheduled_time).getTime()
      ),
    [data?.items]
  )
  const itemIds = useMemo(() => items.map((i) => i.id), [items])

  type AuctionMarker = {
    type: 'silent_auction_start' | 'silent_auction_close'
    time: Date
    label: string
  }

  const auctionMarkers = useMemo((): AuctionMarker[] => {
    const markers: AuctionMarker[] = []
    if (data?.silent_auction_start_datetime) {
      markers.push({
        type: 'silent_auction_start',
        time: new Date(data.silent_auction_start_datetime),
        label: 'Silent Auction Opens',
      })
    }
    if (data?.silent_auction_close_datetime) {
      markers.push({
        type: 'silent_auction_close',
        time: new Date(data.silent_auction_close_datetime),
        label: 'Silent Auction Closes',
      })
    }
    return markers
  }, [data?.silent_auction_start_datetime, data?.silent_auction_close_datetime])

  // ── Mutations ──────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: RunOfShowItemCreate) =>
      createRosItem(eventId, payload),
    onSuccess: () => {
      toast.success('Item added')
      setShowAddForm(false)
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
    },
    onError: () => toast.error('Failed to add item'),
  })

  const { mutate: updateMutate } = useMutation({
    mutationFn: ({
      itemId,
      updates,
    }: {
      itemId: string
      updates: RunOfShowItemUpdate
    }) => updateRosItem(eventId, itemId, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
    },
    onError: () => toast.error('Failed to update item'),
  })

  const { mutate: deleteMutate } = useMutation({
    mutationFn: (itemId: string) => deleteRosItem(eventId, itemId),
    onSuccess: () => {
      toast.success('Item deleted')
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
    },
    onError: () => toast.error('Failed to delete item'),
  })

  const { mutate: completeMutate } = useMutation({
    mutationFn: ({
      itemId,
      isComplete,
    }: {
      itemId: string
      isComplete: boolean
    }) =>
      isComplete
        ? markRosItemComplete(eventId, itemId)
        : markRosItemIncomplete(eventId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
    },
    onError: () => toast.error('Failed to update item status'),
  })

  const saveTemplateMutation = useMutation({
    mutationFn: (name: string) => saveAsRosTemplate(eventId, { name }),
    onSuccess: () => {
      toast.success('Template saved')
      setShowSaveTemplateDialog(false)
      setTemplateName('')
    },
    onError: () => toast.error('Failed to save template'),
  })

  const applyTemplateMutation = useMutation({
    mutationFn: ({
      templateId,
      replace,
    }: {
      templateId: string
      replace: boolean
    }) =>
      applyRosTemplate(eventId, {
        template_id: templateId,
        confirm_replace: replace,
      }),
    onSuccess: (result) => {
      toast.success(
        `Template applied: ${result.items_created} item${result.items_created === 1 ? '' : 's'} created`
      )
      setShowApplyTemplateDialog(false)
      setSelectedTemplateId(null)
      setConfirmReplace(false)
      void queryClient.invalidateQueries({ queryKey: ['ros', eventId] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to apply template'))
    },
  })

  // ── Handlers ──────────────────────────────────────────────────

  const handleUpdate = useCallback(
    (
      itemId: string,
      updates: {
        title?: string
        description?: string | null
        scheduled_time?: string
        donor_visible?: boolean
        auctioneer_visible?: boolean
      }
    ) => {
      updateMutate({ itemId, updates })
    },
    [updateMutate]
  )

  const handleDelete = useCallback(
    (itemId: string) => {
      if (!confirm('Delete this run-of-show item?')) return
      deleteMutate(itemId)
    },
    [deleteMutate]
  )

  const handleToggleComplete = useCallback(
    (itemId: string, isComplete: boolean) => {
      completeMutate({ itemId, isComplete })
    },
    [completeMutate]
  )

  const handleDragEnd = useCallback((_event: DragEndEvent) => {
    // Items are always sorted by scheduled_time; drag-and-drop reordering
    // is intentionally a no-op to preserve time-based ordering.
  }, [])

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return
    applyTemplateMutation.mutate({
      templateId: selectedTemplateId,
      replace: confirmReplace,
    })
  }

  // ── Warning banners ────────────────────────────────────────────

  const hasNoStartTime = !data?.event_start_time && items.length > 0

  if (isLoading) {
    return (
      <div className='flex h-48 items-center justify-center'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <CalendarClock className='text-primary h-5 w-5' />
          <h2 className='text-base font-semibold'>Run of Show</h2>
          {data && data.total_count > 0 && (
            <span className='text-muted-foreground text-sm'>
              ({data.completed_count}/{data.total_count})
            </span>
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setShowAddForm((prev) => !prev)}
          >
            <Plus className='mr-1 h-3 w-3' />
            Add Item
          </Button>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setShowApplyTemplateDialog(true)}
          >
            <ListPlus className='mr-1 h-3 w-3' />
            Apply Template
          </Button>
          {items.length > 0 && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => setShowSaveTemplateDialog(true)}
            >
              <Save className='mr-1 h-3 w-3' />
              Save as Template
            </Button>
          )}
        </div>
      </div>

      {/* Warning banners */}
      {hasNoStartTime && (
        <div className='rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200'>
          ⚠ This event has no start time set. Template times may not be
          accurate.
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <RunOfShowItemForm
          onSubmit={(payload) => createMutation.mutate(payload)}
          onCancel={() => setShowAddForm(false)}
          eventDate={
            data?.event_start_time ? String(data.event_start_time) : undefined
          }
        />
      )}

      {/* Empty state */}
      {!showAddForm && items.length === 0 && auctionMarkers.length === 0 && (
        <div className='flex flex-col items-center gap-2 py-10 text-center'>
          <CalendarClock className='text-muted-foreground h-8 w-8' />
          <p className='text-muted-foreground text-sm'>
            No run-of-show items yet — add one or apply a template.
          </p>
        </div>
      )}

      {/* Auction markers when no items */}
      {!showAddForm && items.length === 0 && auctionMarkers.length > 0 && (
        <div className='grid gap-2'>
          {auctionMarkers
            .slice()
            .sort((a, b) => a.time.getTime() - b.time.getTime())
            .map((marker) => (
              <div
                key={`marker-${marker.type}`}
                className='flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
              >
                <Clock className='h-4 w-4 shrink-0' />
                <span className='font-medium'>{marker.label}</span>
                <span className='text-blue-600 dark:text-blue-400'>
                  {format(marker.time, 'h:mm a')}
                </span>
              </div>
            ))}
          <p className='text-muted-foreground py-4 text-center text-sm'>
            No run-of-show items yet — add one or apply a template.
          </p>
        </div>
      )}

      {/* Sortable list */}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className='grid gap-2'>
              {(() => {
                const rows: React.ReactNode[] = []
                let markerIdx = 0
                const sortedMarkers = [...auctionMarkers].sort(
                  (a, b) => a.time.getTime() - b.time.getTime()
                )

                for (const item of items) {
                  const itemTime = new Date(item.scheduled_time).getTime()
                  while (
                    markerIdx < sortedMarkers.length &&
                    sortedMarkers[markerIdx].time.getTime() <= itemTime
                  ) {
                    const marker = sortedMarkers[markerIdx]
                    rows.push(
                      <div
                        key={`marker-${marker.type}`}
                        className='flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                      >
                        <Clock className='h-4 w-4 shrink-0' />
                        <span className='font-medium'>{marker.label}</span>
                        <span className='text-blue-600 dark:text-blue-400'>
                          {format(marker.time, 'h:mm a')}
                        </span>
                      </div>
                    )
                    markerIdx++
                  }
                  rows.push(
                    <SortableRunOfShowItem
                      key={item.id}
                      eventId={eventId}
                      item={item}
                      eventDate={
                        data?.event_start_time
                          ? String(data.event_start_time)
                          : undefined
                      }
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                    />
                  )
                }

                // Any remaining markers after all items
                while (markerIdx < sortedMarkers.length) {
                  const marker = sortedMarkers[markerIdx]
                  rows.push(
                    <div
                      key={`marker-${marker.type}`}
                      className='flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
                    >
                      <Clock className='h-4 w-4 shrink-0' />
                      <span className='font-medium'>{marker.label}</span>
                      <span className='text-blue-600 dark:text-blue-400'>
                        {format(marker.time, 'h:mm a')}
                      </span>
                    </div>
                  )
                  markerIdx++
                }

                return rows
              })()}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Save as Template dialog */}
      <Dialog
        open={showSaveTemplateDialog}
        onOpenChange={setShowSaveTemplateDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='template-name'>Template name</Label>
            <Input
              id='template-name'
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder='e.g. Gala 2025 Schedule'
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowSaveTemplateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmed = templateName.trim()
                if (trimmed) saveTemplateMutation.mutate(trimmed)
              }}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template dialog */}
      <Dialog
        open={showApplyTemplateDialog}
        onOpenChange={(open) => {
          setShowApplyTemplateDialog(open)
          if (!open) {
            setSelectedTemplateId(null)
            setConfirmReplace(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            {templatesLoading && (
              <p className='text-muted-foreground text-sm'>
                Loading templates...
              </p>
            )}
            {!templatesLoading && (!templates || templates.length === 0) && (
              <p className='text-muted-foreground text-sm'>
                No templates available. Save your current run-of-show as a
                template first.
              </p>
            )}
            {templates && templates.length > 0 && (
              <div className='space-y-1'>
                {templates.map((t: RunOfShowTemplate) => (
                  <button
                    key={t.id}
                    type='button'
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedTemplateId === t.id
                        ? 'bg-accent border-primary'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <span className='font-medium'>{t.name}</span>
                    <span className='text-muted-foreground ml-2 text-xs'>
                      {t.item_count} item{t.item_count === 1 ? '' : 's'}
                      {t.is_system_default && ' · System default'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {items.length > 0 && selectedTemplateId && (
              <div className='space-y-2'>
                <label className='flex cursor-pointer items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                  />
                  Replace existing items when applying template
                </label>
                {!confirmReplace && (
                  <p className='text-muted-foreground text-xs'>
                    ⚠ This event already has run-of-show items. Enable
                    replacement to apply this template.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowApplyTemplateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={
                !selectedTemplateId ||
                applyTemplateMutation.isPending ||
                (items.length > 0 && !confirmReplace)
              }
            >
              {applyTemplateMutation.isPending && (
                <Loader2 className='mr-1 h-4 w-4 animate-spin' />
              )}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
