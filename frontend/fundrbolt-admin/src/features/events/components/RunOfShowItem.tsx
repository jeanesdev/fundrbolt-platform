/**
 * RunOfShowItemRow — Inline-editable row for a single run-of-show item.
 * Shows scheduled time, title, visibility toggles, complete state, and notification bell.
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
  onUpdate: (
    itemId: string,
    updates: {
      title?: string
      scheduled_time?: string
      donor_visible?: boolean
      auctioneer_visible?: boolean
    }
  ) => void
  onDelete: (itemId: string) => void
  onToggleComplete: (itemId: string, isComplete: boolean) => void
  dragHandleProps?: Record<string, unknown>
}

const formatScheduledTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

export function RunOfShowItemRow({
  eventId,
  item,
  onUpdate,
  onDelete,
  onToggleComplete,
  dragHandleProps,
}: RunOfShowItemProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(item.title)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

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

  // Format ISO datetime to local datetime-local input value (YYYY-MM-DDTHH:mm)
  const toDateTimeLocalValue = (iso: string) => {
    try {
      const d = new Date(iso)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    } catch {
      return ''
    }
  }

  const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsEditingTime(false)
    const val = e.target.value
    if (val) {
      const newIso = new Date(val).toISOString()
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
        'rounded-lg border px-3 py-2 transition-colors',
        item.is_complete && 'bg-muted/50 opacity-75'
      )}
    >
      <div className='flex items-center gap-2'>
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className='text-muted-foreground hover:text-foreground shrink-0 cursor-grab'
          >
            <GripVertical className='h-4 w-4' />
          </span>
        )}

        {/* Complete toggle */}
        <button
          type='button'
          onClick={() => onToggleComplete(item.id, !item.is_complete)}
          title={item.is_complete ? 'Mark incomplete' : 'Mark complete'}
          className='shrink-0'
        >
          <Badge
            className={cn(
              'cursor-pointer gap-1 transition-colors',
              item.is_complete
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
            )}
          >
            <Check className='h-3 w-3' />
            <span className='hidden sm:inline'>
              {item.is_complete ? 'Done' : 'Todo'}
            </span>
          </Badge>
        </button>

        {/* Time — click to edit */}
        {isEditingTime ? (
          <input
            ref={timeInputRef}
            type='datetime-local'
            defaultValue={toDateTimeLocalValue(item.scheduled_time)}
            onBlur={handleTimeBlur}
            onKeyDown={handleTimeKeyDown}
            autoFocus
            className='text-muted-foreground h-6 shrink-0 rounded border bg-transparent px-1 text-xs tabular-nums focus:ring-1 focus:ring-blue-500 focus:outline-none'
          />
        ) : (
          <button
            type='button'
            onClick={() => setIsEditingTime(true)}
            className='text-muted-foreground hover:text-foreground shrink-0 rounded px-1 text-xs tabular-nums hover:bg-gray-100 dark:hover:bg-gray-800'
            title='Click to edit time'
          >
            {formatScheduledTime(item.scheduled_time)}
          </button>
        )}

        {/* Title */}
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
                'w-full text-left text-sm hover:underline',
                item.is_complete && 'text-muted-foreground line-through'
              )}
            >
              {item.title}
            </button>
          )}
        </div>

        {/* Visibility toggles */}
        <div className='flex shrink-0 items-center gap-2'>
          <span className='text-muted-foreground hidden text-xs sm:block'>
            D
          </span>
          <Switch
            checked={item.donor_visible}
            onCheckedChange={(checked) =>
              onUpdate(item.id, { donor_visible: checked })
            }
            title='Visible to donors'
            className='scale-75'
          />
          <span className='text-muted-foreground hidden text-xs sm:block'>
            A
          </span>
          <Switch
            checked={item.auctioneer_visible}
            onCheckedChange={(checked) =>
              onUpdate(item.id, { auctioneer_visible: checked })
            }
            title='Visible to auctioneer'
            className='scale-75'
          />
        </div>

        {/* Notification bell */}
        <Button
          type='button'
          size='icon'
          variant='ghost'
          className={cn(
            'h-7 w-7 shrink-0',
            item.has_notification && 'text-amber-500'
          )}
          onClick={() => setShowNotification((prev) => !prev)}
          title={
            item.has_notification ? 'Edit notification' : 'Add notification'
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

      {/* Notification form */}
      {showNotification && (
        <div className='mt-2 border-t pt-2'>
          <RunOfShowNotificationForm
            eventId={eventId}
            itemId={item.id}
            hasExistingNotification={item.has_notification}
            onClose={() => setShowNotification(false)}
          />
        </div>
      )}
    </div>
  )
}
