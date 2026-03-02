import { SignOutDialog } from '@/components/sign-out-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import useDialogState from '@/hooks/use-dialog-state'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventStore } from '@/stores/event-store'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

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
  eventTimezone: string | null | undefined
): Date | null {
  if (!eventDateTime) return null

  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(eventDateTime)
  if (hasExplicitTimezone) {
    const parsed = new Date(eventDateTime)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed
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
    if (Number.isNaN(resolved.getTime())) {
      return null
    }

    return resolved
  } catch {
    const parsed = new Date(eventDateTime)
    if (Number.isNaN(parsed.getTime())) {
      return null
    }
    return parsed
  }
}

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [spoofTimeInput, setSpoofTimeInput] = useState('')
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore((state) => state.getProfilePictureUrl)
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const getEffectiveNowMs = useDebugSpoofStore((state) => state.getEffectiveNowMs)
  const currentEvent = useEventStore((state) => state.currentEvent)
  const setSpoofedTime = useDebugSpoofStore((state) => state.setSpoofedTime)
  const clearSpoofedTime = useDebugSpoofStore((state) => state.clearSpoofedTime)
  const setSpoofedUser = useDebugSpoofStore((state) => state.setSpoofedUser)
  const clearSpoofedUser = useDebugSpoofStore((state) => state.clearSpoofedUser)

  const isSuperAdmin = user?.role === 'super_admin'

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['debug', 'users', 'spoof-list'],
    queryFn: async () => {
      const response = await apiClient.get('/users', {
        params: {
          page: 1,
          per_page: 50,
        },
      })
      return response.data as { items: UserOption[] }
    },
    enabled: isSuperAdmin && !!menuOpen,
    staleTime: 60_000,
  })

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

  useEffect(() => {
    if (timeBaseSpoofMs !== null) {
      const timeoutId = window.setTimeout(() => {
        setSpoofTimeInput(toDateTimeLocalInputValue(new Date(getEffectiveNowMs())))
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [timeBaseSpoofMs, getEffectiveNowMs])

  const filteredUsers = useMemo(() => {
    const users = usersData?.items ?? []
    const term = userSearch.trim().toLowerCase()

    if (!term) {
      return users
    }

    return users.filter((candidate) => {
      const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase()
      return fullName.includes(term) || candidate.email.toLowerCase().includes(term)
    })
  }, [usersData?.items, userSearch])

  const spoofUserTriggerLabel = spoofedUser?.label ? `Spoof User: ${spoofedUser.label}` : 'Spoof User'

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

  const isSpoofActive = isSuperAdmin && (!!spoofedUser || timeBaseSpoofMs !== null)

  return (
    <>
      <DropdownMenu modal={false} open={!!menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={profilePictureUrl || undefined} alt={user?.email || 'User'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {isSpoofActive && (
              <span className='absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white animate-pulse' />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>
                {user ? `${user.first_name} ${user.last_name}` : 'User'}
              </p>
              <p className='text-muted-foreground text-xs leading-none'>
                {user?.email || 'Not logged in'}
              </p>
              {spoofedUser?.label && (
                <p className='text-amber-600 text-xs leading-none'>Spoofing: {spoofedUser.label}</p>
              )}
              {(spoofedUser || timeBaseSpoofMs !== null) && (
                <p className='text-amber-600 text-xs leading-none'>
                  Debug spoof active
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/settings'>Profile</Link>
          </DropdownMenuItem>
          {isSuperAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Debug Tools</DropdownMenuLabel>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {timeBaseSpoofMs !== null ? 'Update Spoof Time' : 'Spoof Time'}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className='w-80 p-3'
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <div className='space-y-2'>
                    <p className='text-muted-foreground text-xs'>
                      Set effective event time (local).
                    </p>
                    <Input
                      type='datetime-local'
                      value={spoofTimeInput}
                      onChange={(event) => setSpoofTimeInput(event.target.value)}
                      placeholder='YYYY-MM-DDTHH:mm'
                      onKeyDown={(event) => event.stopPropagation()}
                    />
                    {timeBaseSpoofMs !== null && (
                      <p className='text-muted-foreground text-xs'>
                        Current spoof: {new Date(getEffectiveNowMs()).toLocaleString()}
                      </p>
                    )}
                    <div className='flex items-center gap-2'>
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
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{spoofUserTriggerLabel}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className='w-80 p-3'
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <div className='mb-3 flex items-center justify-between'>
                    <p className='text-muted-foreground text-xs'>Select a user to spoof</p>
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
                  </div>
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder='Search users by name or email'
                    onKeyDown={(event) => event.stopPropagation()}
                    className='mb-2'
                  />
                  <DropdownMenuRadioGroup
                    value={spoofedUser?.id || '__none__'}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        clearSpoofedUser()
                        return
                      }
                      const match = usersData?.items?.find((candidate) => candidate.id === value)
                      if (!match) return
                      setSpoofedUser(value, `${match.first_name} ${match.last_name}`.trim())
                      toast.success('User spoof enabled')
                    }}
                  >
                    <DropdownMenuRadioItem value='__none__'>No Spoof User</DropdownMenuRadioItem>
                    <div className='mt-2 max-h-64 overflow-y-auto pr-1'>
                      {usersLoading && (
                        <DropdownMenuItem disabled>Loading users...</DropdownMenuItem>
                      )}
                      {!usersLoading && filteredUsers.length === 0 && (
                        <DropdownMenuItem disabled>No users found</DropdownMenuItem>
                      )}
                      {!usersLoading &&
                        filteredUsers.map((candidate) => (
                          <DropdownMenuRadioItem key={candidate.id} value={candidate.id}>
                            {candidate.first_name} {candidate.last_name} ({candidate.email})
                          </DropdownMenuRadioItem>
                        ))}
                    </div>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
