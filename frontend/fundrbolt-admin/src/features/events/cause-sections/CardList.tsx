import { useEffect, useState } from 'react'
import type { CauseSectionCard } from '@/services/cause-section-cards'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Images,
  Layout,
  Pencil,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

interface CardListProps {
  cards: CauseSectionCard[]
  onEdit: (card: CauseSectionCard) => void
  onDelete: (card: CauseSectionCard) => void
  onToggle: (card: CauseSectionCard, isEnabled: boolean) => void
  onReorder: (cardIds: string[]) => void
}

function cardIcon(cardType: CauseSectionCard['card_type']) {
  switch (cardType) {
    case 'text':
      return Type
    case 'slideshow':
      return Images
    case 'video':
      return Video
    case 'built_in':
      return Layout
  }
}

function SortableCardRow({
  card,
  onEdit,
  onDelete,
  onToggle,
}: {
  card: CauseSectionCard
  onEdit: (card: CauseSectionCard) => void
  onDelete: (card: CauseSectionCard) => void
  onToggle: (card: CauseSectionCard, isEnabled: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })
  const {
    ['aria-roledescription']: _ignoredRoleDescription,
    ...sortableAttributes
  } = attributes

  const Icon = cardIcon(card.card_type)

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && 'opacity-60')}
    >
      <Card>
        <CardContent className='flex flex-wrap items-center gap-3 p-4'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='cursor-grab active:cursor-grabbing'
            aria-label={`Reorder ${card.title ?? card.card_type} card`}
            aria-roledescription='sortable'
            {...sortableAttributes}
            {...listeners}
          >
            <GripVertical className='h-4 w-4' />
          </Button>

          <div className='flex min-w-0 flex-1 items-center gap-3'>
            <div className='bg-muted flex h-10 w-10 items-center justify-center rounded-full'>
              <Icon className='h-4 w-4' />
            </div>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='truncate font-medium'>
                  {card.title ||
                    (card.card_type === 'built_in'
                      ? card.built_in_section_key?.replace('_', ' ')
                      : `Untitled ${card.card_type}`)}
                </p>
                {card.card_type === 'built_in' && (
                  <Badge variant='secondary'>Built-in</Badge>
                )}
              </div>
              <p className='text-muted-foreground text-sm capitalize'>
                {card.card_type.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Switch
              checked={card.is_enabled}
              onCheckedChange={(checked) => onToggle(card, checked)}
              aria-label={`Toggle ${card.title ?? card.card_type}`}
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => onEdit(card)}
            >
              <Pencil className='mr-2 h-4 w-4' />
              Edit
            </Button>
            {card.card_type !== 'built_in' && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => onDelete(card)}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CardList({
  cards,
  onEdit,
  onDelete,
  onToggle,
  onReorder,
}: CardListProps) {
  const [localCards, setLocalCards] = useState(cards)

  // Sync from server when cards change (after API success/failure + refresh)
  useEffect(() => {
    setLocalCards(cards)
  }, [cards])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localCards.findIndex((card) => card.id === active.id)
    const newIndex = localCards.findIndex((card) => card.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextCards = arrayMove(localCards, oldIndex, newIndex)
    setLocalCards(nextCards) // Optimistic update — stays in place while API call is in-flight
    onReorder(nextCards.map((card) => card.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={localCards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className='space-y-3'>
          {localCards.map((card) => (
            <SortableCardRow
              key={card.id}
              card={card}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
