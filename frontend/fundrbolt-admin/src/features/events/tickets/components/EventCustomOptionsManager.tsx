/**
 * EventCustomOptionsManager
 * Manages event-level (universal) custom options that apply to every registration.
 * These are separate from per-package custom options.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/axios'
import { getErrorMessage } from '@/lib/error-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EventCustomOptionFormDialog } from './EventCustomOptionFormDialog'

const MAX_EVENT_OPTIONS = 8

interface CustomOption {
  id: string
  event_id: string
  ticket_package_id: string | null
  option_type: 'boolean' | 'multi_select' | 'text_input'
  option_label: string
  choices?: string[]
  is_required: boolean
  display_order: number
  created_at: string
}

interface EventCustomOptionsManagerProps {
  eventId: string
}

export function EventCustomOptionsManager({
  eventId,
}: EventCustomOptionsManagerProps) {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<CustomOption | null>(null)
  const [localOptions, setLocalOptions] = useState<CustomOption[]>([])

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ['event-custom-options', eventId],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/events/${eventId}/options`)
      return response.data as CustomOption[]
    },
  })

  const options = data ?? []

  useEffect(() => {
    setLocalOptions(data ?? [])
  }, [data])

  const reorderMutation = useMutation({
    mutationFn: async (reorderedOptions: CustomOption[]) => {
      await Promise.all(
        reorderedOptions.map((option, index) =>
          apiClient.patch(`/admin/events/${eventId}/options/${option.id}`, {
            display_order: index,
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-custom-options', eventId],
      })
    },
    onError: () => {
      toast.error('Failed to reorder options')
      setLocalOptions(options)
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = localOptions.findIndex((opt) => opt.id === active.id)
      const newIndex = localOptions.findIndex((opt) => opt.id === over.id)
      const reordered = arrayMove(localOptions, oldIndex, newIndex)
      setLocalOptions(reordered)
      reorderMutation.mutate(reordered)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      await apiClient.delete(`/admin/events/${eventId}/options/${optionId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['event-custom-options', eventId],
      })
      toast.success('Custom option has been deleted successfully.')
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const detail = error.response?.data?.detail
      if (detail?.includes('responses')) {
        toast.error('This option has responses and cannot be deleted.')
      } else {
        toast.error(detail || 'Failed to delete option')
      }
    },
  })

  const handleDelete = (option: CustomOption) => {
    if (
      confirm(`Delete "${option.option_label}"? This action cannot be undone.`)
    ) {
      deleteMutation.mutate(option.id)
    }
  }

  const getOptionTypeBadge = (type: string) => {
    const variants = {
      boolean: 'default',
      multi_select: 'secondary',
      text_input: 'outline',
    } as const

    const labels = {
      boolean: 'Yes/No',
      multi_select: 'Multiple Choice',
      text_input: 'Text Input',
    } as const

    return (
      <Badge variant={variants[type as keyof typeof variants]}>
        {labels[type as keyof typeof labels]}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='animate-pulse space-y-3'>
            <div className='h-4 w-1/4 rounded bg-gray-200'></div>
            <div className='h-20 rounded bg-gray-200'></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Universal Registration Questions</CardTitle>
          <CardDescription>
            Failed to load custom options for this event.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex items-center justify-between gap-4'>
          <p className='text-sm text-red-600'>
            {getErrorMessage(error, 'Failed to load custom options')}
          </p>
          <Button variant='outline' onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const canAddMore = options.length < MAX_EVENT_OPTIONS

  function SortableOptionItem({ option }: { option: CustomOption }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: option.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        className='hover:bg-muted/30 flex items-start gap-3 rounded-lg border p-4 transition-colors'
      >
        <div className='cursor-move pt-1' {...attributes} {...listeners}>
          <GripVertical className='h-5 w-5 text-gray-400' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='mb-1 flex items-center gap-2'>
            <h4 className='font-medium'>{option.option_label}</h4>
            {option.is_required && (
              <Badge variant='destructive' className='text-xs'>
                Required
              </Badge>
            )}
            {getOptionTypeBadge(option.option_type)}
          </div>
          {option.option_type === 'multi_select' && option.choices && (
            <div className='mt-2 flex flex-wrap gap-1'>
              {option.choices.map((choice, idx) => (
                <Badge key={idx} variant='outline' className='text-xs'>
                  {choice}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => setEditingOption(option)}
          >
            <Pencil className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => handleDelete(option)}
          >
            <Trash2 className='h-4 w-4 text-red-600' />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Universal Registration Questions</CardTitle>
            <CardDescription>
              These questions appear on every registration, regardless of ticket
              package ({options.length}/{MAX_EVENT_OPTIONS} used)
            </CardDescription>
          </div>
          <Button
            type='button'
            onClick={() => setIsCreateOpen(true)}
            disabled={!canAddMore}
            size='sm'
          >
            <Plus className='mr-2 h-4 w-4' />
            Add Question
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {options.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            <p>No universal questions yet.</p>
            <p className='mt-2 text-sm'>
              Add questions like dietary restrictions, accessibility needs, or
              other info you need from every attendee.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localOptions.map((opt) => opt.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className='space-y-3'>
                {localOptions.map((option) => (
                  <SortableOptionItem key={option.id} option={option} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      <EventCustomOptionFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        eventId={eventId}
        mode='create'
      />

      {editingOption && (
        <EventCustomOptionFormDialog
          open={!!editingOption}
          onOpenChange={(open: boolean) => !open && setEditingOption(null)}
          eventId={eventId}
          mode='edit'
          option={editingOption}
        />
      )}
    </Card>
  )
}
