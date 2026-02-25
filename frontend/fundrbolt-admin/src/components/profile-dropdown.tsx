import { SignOutDialog } from '@/components/sign-out-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventStore } from '@/stores/event-store'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

function toDateTimeLocalInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore((state) => state.getProfilePictureUrl)
  const currentEventDateTime = useEventStore((state) => state.currentEvent?.event_datetime)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const getEffectiveNowMs = useDebugSpoofStore((state) => state.getEffectiveNowMs)
  const setSpoofedTime = useDebugSpoofStore((state) => state.setSpoofedTime)
  const clearSpoofedTime = useDebugSpoofStore((state) => state.clearSpoofedTime)
  const [spoofTimeInput, setSpoofTimeInput] = useState(() =>
    timeBaseSpoofMs === null ? '' : toDateTimeLocalInputValue(new Date(getEffectiveNowMs()))
  )

  const isSuperAdmin = user?.role === 'super_admin'

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()
  const eventStartDate = currentEventDateTime ? new Date(currentEventDateTime) : null
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

  return (
    <>
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={profilePictureUrl || undefined} alt={user?.email || 'User'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
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
              {timeBaseSpoofMs !== null && (
                <p className='text-amber-600 text-xs leading-none'>Debug time spoof active</p>
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
                  className='w-80 space-y-2 p-3'
                >
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
                        if (!eventStartDate) {
                          return
                        }
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
