/**
 * DebugSpoofSheet — full-screen bottom sheet with swipeable pages
 * for Spoof Time and Spoof User debug tools.
 *
 * - Swipe left / right to switch pages
 * - Swipe down to dismiss the sheet
 * - Only visible to super_admin users
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import apiClient from '@/lib/axios'
import { cn } from '@/lib/utils'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventStore } from '@/stores/event-store'
import { useQuery } from '@tanstack/react-query'
import { Clock, User, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

// ─── Helpers ────────────────────────────────────────────────────────────────

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

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

// ─── Constants ──────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD_X = 50
const SWIPE_THRESHOLD_Y = 80
const PAGES = ['time', 'user'] as const
type Page = (typeof PAGES)[number]

// ─── Component ──────────────────────────────────────────────────────────────

interface DebugSpoofSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DebugSpoofSheet({ open, onOpenChange }: DebugSpoofSheetProps) {
  const [page, setPage] = useState<Page>('time')
  const [userSearch, setUserSearch] = useState('')
  const [spoofTimeInput, setSpoofTimeInput] = useState('')

  // Touch tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  )

  // Store access
  const spoofedUser = useDebugSpoofStore((s) => s.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((s) => s.timeBaseSpoofMs)
  const getEffectiveNowMs = useDebugSpoofStore((s) => s.getEffectiveNowMs)
  const setSpoofedTime = useDebugSpoofStore((s) => s.setSpoofedTime)
  const clearSpoofedTime = useDebugSpoofStore((s) => s.clearSpoofedTime)
  const setSpoofedUser = useDebugSpoofStore((s) => s.setSpoofedUser)
  const clearSpoofedUser = useDebugSpoofStore((s) => s.clearSpoofedUser)
  const currentEvent = useEventStore((s) => s.currentEvent)

  // Users query – fetch all pages (backend caps per_page at 100)
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['debug', 'users', 'spoof-list'],
    queryFn: async () => {
      const allItems: UserOption[] = []
      let page = 1
      let total = Infinity
      while (allItems.length < total) {
        const response = await apiClient.get('/users', {
          params: { page, per_page: 100 },
        })
        const data = response.data as {
          items: UserOption[]
          total: number
        }
        allItems.push(...data.items)
        total = data.total
        page++
      }
      return { items: allItems }
    },
    enabled: open,
    staleTime: 60_000,
  })

  // Initialise time input when sheet opens
  useEffect(() => {
    if (open && timeBaseSpoofMs !== null) {
      setSpoofTimeInput(
        toDateTimeLocalInputValue(new Date(getEffectiveNowMs())),
      )
    }
  }, [open, timeBaseSpoofMs, getEffectiveNowMs])

  // Reset page when sheet opens
  useEffect(() => {
    if (open) {
      setPage('time')
      setUserSearch('')
    }
  }, [open])

  // Filtered users
  const filteredUsers = useMemo(() => {
    const users = usersData?.items ?? []
    const term = userSearch.trim().toLowerCase()
    if (!term) return users
    return users.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase()
      return fullName.includes(term) || c.email.toLowerCase().includes(term)
    })
  }, [usersData?.items, userSearch])

  // Event start date for "Event Start" button
  const currentEventRecord = currentEvent as Record<string, unknown> | null
  const resolvedEventDateTime =
    currentEvent?.event_datetime ??
    (typeof currentEventRecord?.eventDateTime === 'string'
      ? currentEventRecord.eventDateTime
      : null) ??
    (typeof currentEventRecord?.event_date === 'string'
      ? currentEventRecord.event_date
      : null) ??
    (typeof currentEventRecord?.eventDate === 'string'
      ? currentEventRecord.eventDate
      : null)

  const resolvedEventTimezone =
    currentEvent?.timezone ??
    (typeof currentEventRecord?.event_timezone === 'string'
      ? currentEventRecord.event_timezone
      : null) ??
    (typeof currentEventRecord?.time_zone === 'string'
      ? currentEventRecord.time_zone
      : null)

  const eventStartDate = parseEventStartForSpoof(
    resolvedEventDateTime,
    resolvedEventTimezone,
  )
  const hasValidEventStart =
    !!eventStartDate && !Number.isNaN(eventStartDate.getTime())

  // ── Actions ─────────────────────────────────────────────────────────────

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

  const handleSelectUser = (userId: string) => {
    if (userId === '__none__') {
      clearSpoofedUser()
      toast.success('User spoof cleared')
      return
    }
    const match = usersData?.items?.find((c) => c.id === userId)
    if (!match) return
    setSpoofedUser(
      userId,
      `${match.first_name} ${match.last_name}`.trim(),
    )
    toast.success('User spoof enabled')
  }

  // ── Touch handling ──────────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current
    if (!start) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - start.x)
    const dy = Math.abs(touch.clientY - start.y)
    // If horizontal motion dominates, prevent vertical scroll
    if (dx > dy && dx > 10) {
      e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current
      if (!start) return
      const touch = e.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      // Horizontal swipe — change page
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD_X) {
        if (dx < 0) {
          // swipe left → next page
          setPage((p) => (p === 'time' ? 'user' : 'time'))
        } else {
          // swipe right → prev page
          setPage((p) => (p === 'user' ? 'time' : 'user'))
        }
      }
      // Vertical swipe down — close
      else if (dy > SWIPE_THRESHOLD_Y && Math.abs(dy) > Math.abs(dx)) {
        onOpenChange(false)
      }

      touchStartRef.current = null
    },
    [onOpenChange],
  )

  // ── Render ──────────────────────────────────────────────────────────────

  if (!open) return null

  const pageIndex = PAGES.indexOf(page)

  return createPortal(
    <div
      className='fixed inset-0 z-50'
      role='dialog'
      aria-modal='true'
      aria-label='Debug Spoof Tools'
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/50 animate-in fade-in-0'
        onClick={() => onOpenChange(false)}
        aria-hidden='true'
      />

      {/* Sheet — force light-theme variables so inputs/buttons are readable on white */}
      <div
        className='absolute inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl animate-in slide-in-from-bottom duration-300'
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

        {/* Header with close button */}
        <div className='flex items-center justify-between px-4 pb-2'>
          <h2 className='text-lg font-semibold text-gray-900'>Debug Tools</h2>
          <button
            type='button'
            onClick={() => onOpenChange(false)}
            className='rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            aria-label='Close'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* Page tabs */}
        <div className='mx-4 mb-3 flex gap-1 rounded-lg bg-gray-100 p-1'>
          <button
            type='button'
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              page === 'time'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500',
            )}
            onClick={() => setPage('time')}
          >
            <Clock className='h-4 w-4' />
            Spoof Time
          </button>
          <button
            type='button'
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              page === 'user'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500',
            )}
            onClick={() => setPage('user')}
          >
            <User className='h-4 w-4' />
            Spoof User
          </button>
        </div>

        {/* Swipeable page container */}
        <div className='min-h-0 flex-1 overflow-hidden'>
          <div
            className='flex h-full transition-transform duration-300 ease-out'
            style={{ transform: `translateX(-${pageIndex * 100}%)` }}
          >
            {/* Page 1: Spoof Time */}
            <div className='h-full w-full flex-shrink-0 overflow-y-auto px-4 pb-6'>
              <div className='space-y-4'>
                <p className='text-sm text-gray-500'>
                  Override the effective time to test event states (pre-event,
                  during, post-event).
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
                    Currently spoofing:{' '}
                    {new Date(getEffectiveNowMs()).toLocaleString()}
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
                      setSpoofTimeInput(
                        toDateTimeLocalInputValue(eventStartDate),
                      )
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

            {/* Page 2: Spoof User */}
            <div className='h-full w-full flex-shrink-0 overflow-y-auto px-4 pb-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm text-gray-500'>
                    Impersonate a user to test their view.
                  </p>
                  {spoofedUser && (
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        clearSpoofedUser()
                        toast.success('User spoof cleared')
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {spoofedUser && (
                  <p className='text-sm text-amber-600'>
                    Spoofing: {spoofedUser.label}
                  </p>
                )}

                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder='Search users by name or email'
                  className='text-base'
                />

                <div className='max-h-64 space-y-1 overflow-y-auto'>
                  {/* No spoof option */}
                  <button
                    type='button'
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      !spoofedUser
                        ? 'bg-blue-50 font-medium text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                    onClick={() => handleSelectUser('__none__')}
                  >
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600'>
                      —
                    </div>
                    <span>No Spoof User</span>
                  </button>

                  {usersLoading && (
                    <p className='px-3 py-4 text-center text-sm text-gray-400'>
                      Loading users…
                    </p>
                  )}

                  {!usersLoading && filteredUsers.length === 0 && (
                    <p className='px-3 py-4 text-center text-sm text-gray-400'>
                      No users found
                    </p>
                  )}

                  {!usersLoading &&
                    filteredUsers.map((candidate) => {
                      const isActive = spoofedUser?.id === candidate.id
                      const initials = `${candidate.first_name?.[0] ?? ''}${candidate.last_name?.[0] ?? ''}`.toUpperCase()
                      return (
                        <button
                          key={candidate.id}
                          type='button'
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                            isActive
                              ? 'bg-blue-50 font-medium text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50',
                          )}
                          onClick={() => handleSelectUser(candidate.id)}
                        >
                          <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600'>
                            {initials}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <p className='truncate font-medium'>
                              {candidate.first_name} {candidate.last_name}
                            </p>
                            <p className='truncate text-xs text-gray-400'>
                              {candidate.email}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page indicator dots */}
        <div className='flex justify-center gap-2 pb-4 pt-2'>
          {PAGES.map((p) => (
            <div
              key={p}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                page === p ? 'w-6 bg-gray-800' : 'w-1.5 bg-gray-300',
              )}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
