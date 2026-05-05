/**
 * RunOfShowItemCard — Card-style editable item for a single run-of-show entry.
 * Shows scheduled time (time-only edit using event date), title, visibility
 * toggles, complete state, and notification bell. Designed for mobile-first.
 */
import { useRef, useState } from 'react'
import type { RunOfShowItem } from '@/types/run-of-show'
import { Bell, Check, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { RunOfShowNotificationForm } from './RunOfShowNotificationForm'

interface RunOfShowItemProps {
  eventId: string
  item: RunOfShowItem
  /** ISO datetime of the event start — used as the date portion when editing time */
  eventDate?: string
  onUpdate: (
    itemId: string,
    updates: {
      title?: string
      description?: string | null
      scheduled_time?: string
      donor_visible?: boolean
      auctioneer_visible?: boolean
    }
  ) => void
  onDelete: (itemId: string) => void
  onToggleComplete: (itemId: string, isComplete: boolean) => void
  dragHandleProps?: Record<string, unknown>
}

/** Format ISO datetime to display time only (e.g. "6:30 PM") */
const formatScheduledTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

/** Extract HH:mm from ISO string for <input type="time"> */
const toTimeValue = (iso: string | null | undefined): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

/** Get a YYYY-MM-DD date string from eventDate or existing scheduled_time */
const getDateStr = (
  eventDate?: string,
  scheduledTime?: string | null
): string => {
  const source = eventDate ?? scheduledTime
  if (source) {
    try {
      const d = new Date(source)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    } catch {
      // fall through
    }
  }
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

/** Combine a YYYY-MM-DD date string and HH:mm time string to ISO UTC */
const combineDateTimeToIso = (dateStr: string, timeStr: string): string =>
  new Date(`${dateStr}T${timeStr}`).toISOString()

export function RunOfShowItemRow({
  eventId,
  item,
  eventDate,
  onUpdate,
  onDelete,
  onToggleComplete,
  dragHandleProps,
}: RunOfShowItemProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(item.title)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [descriptionValue, setDescriptionValue] = useState(
    item.description ?? ''
  )
  const [showNotification, setShowNotification] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const handleTitleClick = () => {
    setIsEditingTitle(true)
    setTitleValue(item.title)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== item.title) {
      onUpdate(item.id, { title: trimmed })
    } else {
      setTitleValue(item.title)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setTitleValue(item.title)
      setIsEditingTitle(false)
    }
  }

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false)
    const trimmed = descriptionValue.trim() || null
    if (trimmed !== (item.description ?? null)) {
      onUpdate(item.id, { description: trimmed })
    }
  }

  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Escape') {
      setDescriptionValue(item.description ?? '')
      setIsEditingDescription(false)
    }
  }

  const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditingTime(false)
    const val = e.target.value
    if (val) {
      const dateStr = getDateStr(eventDate, item.scheduled_time)
      const newIso = combineDateTimeToIso(dateStr, val)
      if (newIso !== item.scheduled_time) {
        onUpdate(item.id, { scheduled_time: newIso })
      }
    }
  }

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setIsEditingTime(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        item.is_complete
          ? 'bg-muted/40 opacity-75'
          : 'bg-card hover:bg-accent/5'
      )}
    >
      {/* Top row: drag handle · time · spacer · notification · delete */}
      <div className='mb-2 flex items-center gap-2'>
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className='text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing'
          >
            <GripVertical className='h-4 w-4' />
          </span>
        )}

        {/* Time — tap to edit (time-only, date assumed from event) */}
        {isEditingTime ? (
          <input
            ref={timeInputRef}
            type='time'
            defaultValue={toTimeValue(item.scheduled_time)}
            onBlur={handleTimeBlur}
            onKeyDown={handleTimeKeyDown}
            autoFocus
            className='text-muted-foreground h-6 w-24 shrink-0 rounded border bg-transparent px-1 text-xs tabular-nums focus:ring-1 focus:ring-blue-500 focus:outline-none'
          />
        ) : (
          <button
            type='button'
            onClick={() => setIsEditingTime(true)}
            className={cn(
              'text-muted-foreground hover:text-foreground shrink-0 rounded px-1.5 py-0.5 text-xs tabular-nums hover:bg-gray-100 dark:hover:bg-gray-800',
              'border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
            )}
            title='Tap to change time'
          >
            {formatScheduledTime(item.scheduled_time)}
          </button>
        )}

        <div className='flex-1' />

        {/* Notification bell */}
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className={cn(
            'h-7 w-7 shrink-0',
            item.notifications.length > 0 && 'text-amber-500'
          )}
          onClick={() => setShowNotification((prev) => !prev)}
          title={
            item.notifications.length > 0
              ? 'Edit notifications'
              : 'Add notification'
          }
        >
          <Bell className='h-3.5 w-3.5' />
        </Button>

        {/* Delete */}
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className='h-7 w-7 shrink-0 text-red-500 hover:text-red-700'
          onClick={() => onDelete(item.id)}
          title='Delete item'
        >
          <Trash2 className='h-3.5 w-3.5' />
        </Button>
      </div>

      {/* Title row: complete toggle + title (full width) */}
      <div className='flex items-start gap-2'>
        <button
          type='button'
          onClick={() => onToggleComplete(item.id, !item.is_complete)}
          title={item.is_complete ? 'Mark incomplete' : 'Mark complete'}
          className='mt-0.5 shrink-0'
        >
          <Badge
            className={cn(
              'cursor-pointer gap-1 transition-colors',
              item.is_complete
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            )}
          >
            <Check className='h-3 w-3' />
          </Badge>
        </button>

        <div className='min-w-0 flex-1'>
          {isEditingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className='h-7 text-sm'
              maxLength={200}
            />
          ) : (
            <button
              type='button'
              onClick={handleTitleClick}
              className={cn(
                'w-full text-left text-sm leading-snug',
                item.is_complete
                  ? 'text-muted-foreground line-through'
                  : 'hover:underline'
              )}
            >
              {item.title}
            </button>
          )}
        </div>
      </div>

      {/* Description row */}
      <div className='mt-1.5 min-w-0 pl-7'>
        {isEditingDescription ? (
          <textarea
            ref={descriptionRef}
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={handleDescriptionKeyDown}
            rows={2}
            placeholder='Add a description...'
            className='text-muted-foreground w-full resize-none rounded border bg-transparent px-1.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none'
            autoFocus
          />
        ) : (
          <button
            type='button'
            onClick={() => {
              setDescriptionValue(item.description ?? '')
              setIsEditingDescription(true)
              setTimeout(() => descriptionRef.current?.focus(), 0)
            }}
            className={cn(
              'w-full text-left text-xs',
              item.description
                ? 'text-muted-foreground hover:underline'
                : 'text-muted-foreground/50 hover:text-muted-foreground italic'
            )}
          >
            {item.description || 'Add description...'}
          </button>
        )}
      </div>

      {/* Visibility row */}
      <div className='mt-2 flex items-center gap-4 text-xs'>
        <label className='text-muted-foreground flex cursor-pointer items-center gap-1.5'>
          <Switch
            checked={item.donor_visible}
            onCheckedChange={(checked) =>
              onUpdate(item.id, { donor_visible: checked })
            }
            title='Visible to donors'
            className='scale-75'
          />
          Donor
        </label>
        <label className='text-muted-foreground flex cursor-pointer items-center gap-1.5'>
          <Switch
            checked={item.auctioneer_visible}
            onCheckedChange={(checked) =>
              onUpdate(item.id, { auctioneer_visible: checked })
            }
            title='Visible to auctioneer'
            className='scale-75'
          />
          Auctioneer
        </label>
      </div>

      {/* Notification form (expanded) */}
      {showNotification && (
        <div className='mt-3 border-t pt-3'>
          <RunOfShowNotificationForm
            eventId={eventId}
            itemId={item.id}
            existingNotifications={item.notifications}
            onClose={() => setShowNotification(false)}
          />
        </div>
      )}
    </div>
  )
}
