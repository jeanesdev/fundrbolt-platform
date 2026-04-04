/**
 * ChecklistPanel — Persistent panel above tabs on the event edit page
 * Renders progress bar, item list, and action buttons
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ChecklistItem, ChecklistItemStatus } from '@/types/checklist'
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ListPlus,
  Plus,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useChecklistStore } from '@/stores/checklistStore'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChecklistItemForm } from './ChecklistItemForm'
import { ChecklistProgressBar } from './ChecklistProgressBar'
import { SortableChecklistItem } from './SortableChecklistItem'

interface ChecklistPanelProps {
  eventId: string
  npoId?: string
}

export function ChecklistPanel({ eventId, npoId }: ChecklistPanelProps) {
  const {
    checklist,
    isLoading,
    fetchChecklist,
    createItem,
    updateItem,
    updateItemStatus,
    deleteItem,
    reorderItems,
  } = useChecklistStore()

  const [isOpen, setIsOpen] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [showApplyTemplate, setShowApplyTemplate] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showManageTemplates, setShowManageTemplates] = useState(false)

  useEffect(() => {
    fetchChecklist(eventId).catch(() => {
      // Error is set in store
    })
  }, [eventId, fetchChecklist])

  const handleStatusChange = useCallback(
    async (itemId: string, newStatus: ChecklistItemStatus) => {
      try {
        await updateItemStatus(eventId, itemId, { status: newStatus })
      } catch {
        toast.error('Failed to update status')
      }
    },
    [eventId, updateItemStatus]
  )

  const handleAddItem = useCallback(
    async (title: string, dueDate: string | null) => {
      try {
        await createItem(eventId, { title, due_date: dueDate })
        setShowForm(false)
        toast.success('Item added')
      } catch {
        toast.error('Failed to add item')
      }
    },
    [eventId, createItem]
  )

  const handleEditItem = useCallback(
    async (title: string, dueDate: string | null) => {
      if (!editingItem) return
      try {
        await updateItem(eventId, editingItem.id, { title, due_date: dueDate })
        setEditingItem(null)
        toast.success('Item updated')
      } catch {
        toast.error('Failed to update item')
      }
    },
    [eventId, editingItem, updateItem]
  )

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      if (!confirm('Delete this checklist item?')) return
      try {
        await deleteItem(eventId, itemId)
        toast.success('Item deleted')
      } catch {
        toast.error('Failed to delete item')
      }
    },
    [eventId, deleteItem]
  )

  const items = useMemo(() => checklist?.items ?? [], [checklist?.items])
  const isEmpty = items.length === 0 && !isLoading
  const itemIds = useMemo(() => items.map((i) => i.id), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(items, oldIndex, newIndex)
      try {
        await reorderItems(eventId, { item_ids: reordered.map((i) => i.id) })
      } catch {
        toast.error('Failed to reorder items')
      }
    },
    [items, eventId, reorderItems]
  )

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className='bg-card rounded-lg border shadow-sm'>
        <CollapsibleTrigger asChild>
          <button className='flex w-full items-center justify-between px-4 py-3 text-left'>
            <div className='flex items-center gap-2'>
              <ClipboardList className='text-primary h-5 w-5' />
              <h2 className='text-base font-semibold'>Planning Checklist</h2>
              {checklist && checklist.total_count > 0 && (
                <span className='text-muted-foreground text-sm'>
                  ({checklist.completed_count}/{checklist.total_count})
                </span>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className='space-y-3 px-4 pb-4'>
            {/* Progress Bar */}
            {checklist && checklist.total_count > 0 && (
              <ChecklistProgressBar
                totalCount={checklist.total_count}
                completedCount={checklist.completed_count}
                inProgressCount={checklist.in_progress_count}
                overdueCount={checklist.overdue_count}
                progressPercentage={checklist.progress_percentage}
              />
            )}

            {/* Loading */}
            {isLoading && items.length === 0 && (
              <p className='text-muted-foreground py-4 text-center text-sm'>
                Loading checklist...
              </p>
            )}

            {/* Empty State */}
            {isEmpty && (
              <div className='flex flex-col items-center gap-2 py-6 text-center'>
                <ClipboardList className='text-muted-foreground h-8 w-8' />
                <p className='text-muted-foreground text-sm'>
                  No checklist items — add one or apply a template.
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setShowForm(true)}
                  >
                    <Plus className='mr-1 h-3 w-3' />
                    Add Item
                  </Button>
                  {npoId && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setShowApplyTemplate(true)}
                    >
                      <ListPlus className='mr-1 h-3 w-3' />
                      Apply Template
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Item List */}
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
                  <div className='space-y-1'>
                    {items.map((item) =>
                      editingItem?.id === item.id ? (
                        <ChecklistItemForm
                          key={item.id}
                          editingItem={item}
                          onSubmit={handleEditItem}
                          onCancel={() => setEditingItem(null)}
                        />
                      ) : (
                        <SortableChecklistItem
                          key={item.id}
                          item={item}
                          onStatusChange={handleStatusChange}
                          onEdit={(i) => setEditingItem(i)}
                          onDelete={handleDeleteItem}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add Form */}
            {showForm && (
              <ChecklistItemForm
                onSubmit={handleAddItem}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* Action Buttons */}
            {!isEmpty && !showForm && (
              <div className='flex flex-wrap gap-2 pt-1'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => setShowForm(true)}
                >
                  <Plus className='mr-1 h-3 w-3' />
                  Add Item
                </Button>
                {npoId && (
                  <>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setShowApplyTemplate(true)}
                    >
                      <ListPlus className='mr-1 h-3 w-3' />
                      Apply Template
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setShowSaveTemplate(true)}
                    >
                      Save as Template
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setShowManageTemplates(true)}
                    >
                      <Settings2 className='mr-1 h-3 w-3' />
                      Manage Templates
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>

      {/* Dialogs rendered conditionally */}
      {showApplyTemplate && npoId && (
        <ApplyTemplateDialogLazy
          eventId={eventId}
          npoId={npoId}
          onClose={() => setShowApplyTemplate(false)}
        />
      )}
      {showSaveTemplate && (
        <SaveTemplateDialogLazy
          eventId={eventId}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
      {showManageTemplates && npoId && (
        <TemplateManagementDialogLazy
          npoId={npoId}
          onClose={() => setShowManageTemplates(false)}
        />
      )}
    </Collapsible>
  )
}

// Lazy-loaded dialog components
const ApplyTemplateDialogComponent = lazy(() => import('./ApplyTemplateDialog'))
const SaveTemplateDialogComponent = lazy(() => import('./SaveTemplateDialog'))
const TemplateManagementDialogComponent = lazy(
  () => import('./TemplateManagementDialog')
)

function ApplyTemplateDialogLazy({
  eventId,
  npoId,
  onClose,
}: {
  eventId: string
  npoId: string
  onClose: () => void
}) {
  return (
    <Suspense fallback={null}>
      <ApplyTemplateDialogComponent
        eventId={eventId}
        npoId={npoId}
        onClose={onClose}
      />
    </Suspense>
  )
}

function SaveTemplateDialogLazy({
  eventId,
  onClose,
}: {
  eventId: string
  onClose: () => void
}) {
  return (
    <Suspense fallback={null}>
      <SaveTemplateDialogComponent eventId={eventId} onClose={onClose} />
    </Suspense>
  )
}

function TemplateManagementDialogLazy({
  npoId,
  onClose,
}: {
  npoId: string
  onClose: () => void
}) {
  return (
    <Suspense fallback={null}>
      <TemplateManagementDialogComponent npoId={npoId} onClose={onClose} />
    </Suspense>
  )
}
