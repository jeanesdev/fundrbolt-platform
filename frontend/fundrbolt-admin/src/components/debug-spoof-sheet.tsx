/**
 * DebugSpoofSheet — bottom sheet for the Spoof Time debug tool.
 * Swipe down to dismiss. Only shown to super_admin users.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventStore } from '@/stores/event-store'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateTimeLocalInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseEventStartForSpoof(
  eventDateTime: string | null | undefined,
  eventTimezone: string | null | undefined,
): Date | null {
  if (!eventDateTime) return null

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(eventDateTime)
  if (hasExplicitTimezone) {
    const parsed = new Date(eventDateTime)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const localMatch = eventDateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
  )
  if (!localMatch) {
    const fallbackParsed = new Date(eventDateTime)
    return Number.isNaN(fallbackParsed.getTime()) ? null : fallbackParsed
  }

  const year = Number(localMatch[1])
  const month = Number(localMatch[2])
  const day = Number(localMatch[3])
  const hour = Number(localMatch[4])
  const minute = Number(localMatch[5])
  const second = Number(localMatch[6] ?? '0')

  if (!eventTimezone) {
    const parsed = new Date(year, month - 1, day, hour, minute, second)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const targetAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second)

  const formatInTimeZone = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: eventTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date)

    const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = parts.find((part) => part.type === type)?.value
      return value ? Number(value) : 0
    }

    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
      hour: getPart('hour'),
      minute: getPart('minute'),
      second: getPart('second'),
    }
  }

  try {
    let guessUtcMs = targetAsUtcMs
    for (let i = 0; i < 3; i += 1) {
      const zoned = formatInTimeZone(new Date(guessUtcMs))
      if (!zoned.year || !zoned.month || !zoned.day) break
      const guessAsLocalUtcMs = Date.UTC(
        zoned.year,
        zoned.month - 1,
        zoned.day,
        zoned.hour,
        zoned.minute,
        zoned.second,
      )
      const diffMs = targetAsUtcMs - guessAsLocalUtcMs
      if (diffMs === 0) break
      guessUtcMs += diffMs
    }
    const resolved = new Date(guessUtcMs)
    return Number.isNaN(resolved.getTime()) ? null : resolved
  } catch {
    const parsed = new Date(eventDateTime)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD_Y = 80

// ─── Component ───────────────────────────────────────────────────────────────

interface DebugSpoofSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DebugSpoofSheet({ open, onOpenChange }: DebugSpoofSheetProps) {
  const [spoofTimeInput, setSpoofTimeInput] = useState('')

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)

  const timeBaseSpoofMs = useDebugSpoofStore((s) => s.timeBaseSpoofMs)
  const getEffectiveNowMs = useDebugSpoofStore((s) => s.getEffectiveNowMs)
  const setSpoofedTime = useDebugSpoofStore((s) => s.setSpoofedTime)
  const clearSpoofedTime = useDebugSpoofStore((s) => s.clearSpoofedTime)
  const currentEvent = useEventStore((s) => s.currentEvent)

  // Initialise time input when sheet opens
  useEffect(() => {
    if (open && timeBaseSpoofMs !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpoofTimeInput(toDateTimeLocalInputValue(new Date(getEffectiveNowMs())))
    }
  }, [open, timeBaseSpoofMs, getEffectiveNowMs])

  // Resolve event start date
  const currentEventRecord = currentEvent as Record<string, unknown> | null
  const resolvedEventDateTime =
    currentEvent?.event_datetime ??
    (typeof currentEventRecord?.eventDateTime === 'string'
      ? currentEventRecord.eventDateTime
      : null) ??
    null

  const resolvedEventTimezone =
    currentEvent?.timezone ??
    (typeof currentEventRecord?.event_timezone === 'string'
      ? currentEventRecord.event_timezone
      : null) ??
    null

  const eventStartDate = parseEventStartForSpoof(resolvedEventDateTime, resolvedEventTimezone)
  const hasValidEventStart = !!eventStartDate && !Number.isNaN(eventStartDate.getTime())

  const handleSpoofTimeApply = () => {
    const trimmed = spoofTimeInput.trim()
    if (!trimmed) {
      clearSpoofedTime()
      toast.success('Time spoof cleared')
      return
    }
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      toast.error('Invalid date/time format')
      return
    }
    setSpoofedTime(parsed)
    toast.success('Time spoof enabled')
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      if (!start) return
      const touch = e.changedTouches[0]
      if (!touch) return
      const dy = touch.clientY - start.y
      const dx = touch.clientX - start.x
      if (dy > SWIPE_THRESHOLD_Y && Math.abs(dy) > Math.abs(dx)) {
        onOpenChange(false)
      }
      touchStartRef.current = null
    },
    [onOpenChange],
  )

  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-50'
      role='dialog'
      aria-modal='true'
      aria-label='Debug Spoof Tools'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 animate-in fade-in-0'
        onClick={() => onOpenChange(false)}
        aria-hidden='true'
      />

      {/* Sheet */}
      <div
        className='absolute inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl animate-in slide-in-from-bottom duration-300'
        style={{
          '--foreground': 'oklch(0.18 0.06 250)',
          '--background': 'oklch(0.98 0.008 250)',
          '--muted-foreground': 'oklch(0.50 0.06 250)',
          '--border': 'oklch(0.88 0.03 250)',
          '--input': 'oklch(0.88 0.03 250)',
          '--ring': 'oklch(0.50 0.10 250)',
          '--primary': 'oklch(0.35 0.12 250)',
          '--primary-foreground': 'oklch(0.98 0.008 250)',
          '--secondary': 'oklch(0.92 0.02 250)',
          '--secondary-foreground': 'oklch(0.25 0.08 250)',
          '--accent': 'oklch(0.88 0.04 250)',
          '--accent-foreground': 'oklch(0.25 0.08 250)',
          color: 'oklch(0.18 0.06 250)',
        } as React.CSSProperties}
      >
        {/* Drag handle */}
        <div className='flex justify-center pt-3 pb-1'>
          <div className='h-1.5 w-12 rounded-full bg-gray-300' />
        </div>

        {/* Header */}
        <div className='flex items-center justify-between px-4 pb-2'>
          <h2 className='text-lg font-semibold text-gray-900'>Debug Tools — Spoof Time</h2>
          <button
            type='button'
            onClick={() => onOpenChange(false)}
            className='rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            aria-label='Close'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* Content */}
        <div className='overflow-y-auto px-4 pb-8'>
          <div className='space-y-4'>
            <p className='text-sm text-gray-500'>
              Override the effective time to test event states (pre-event, during, post-event).
            </p>

            <div>
              <label
                htmlFor='spoof-time-input'
                className='mb-1.5 block text-sm font-medium text-gray-700'
              >
                Date &amp; Time
              </label>
              <Input
                id='spoof-time-input'
                type='datetime-local'
                value={spoofTimeInput}
                onChange={(e) => setSpoofTimeInput(e.target.value)}
                placeholder='YYYY-MM-DDTHH:mm'
                className='text-base'
              />
            </div>

            {timeBaseSpoofMs !== null && (
              <p className='text-sm text-amber-600'>
                Currently spoofing: {new Date(getEffectiveNowMs()).toLocaleString()}
              </p>
            )}

            <div className='flex flex-wrap gap-2'>
              <Button type='button' size='sm' onClick={handleSpoofTimeApply}>
                Apply
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={!hasValidEventStart}
                onClick={() => {
                  if (!eventStartDate) return
                  setSpoofedTime(eventStartDate)
                  setSpoofTimeInput(toDateTimeLocalInputValue(eventStartDate))
                  toast.success('Time spoof set to event start')
                }}
              >
                Event Start
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={() => {
                  setSpoofTimeInput('')
                  clearSpoofedTime()
                  toast.success('Time spoof cleared')
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
