import { DebugSpoofSheet } from '@/components/debug-spoof-sheet'
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
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, Calendar, Check, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [spoofSheetOpen, setSpoofSheetOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore((state) => state.getProfilePictureUrl)
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const availableEvents = useEventContextStore((state) => state.availableEvents)
  const selectedEventSlug = useEventContextStore((state) => state.selectedEventSlug)
  const isSuperAdmin = user?.role === 'super_admin'

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

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
          {availableEvents.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Calendar className='mr-2 size-4' />
                <div className='flex min-w-0 flex-1 flex-col text-left'>
                  <span>Event</span>
                  <span className='text-muted-foreground truncate text-xs font-normal'>
                    {availableEvents.find((e) => e.slug === selectedEventSlug)?.name ?? 'Select Event'}
                  </span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className='w-64'>
                <DropdownMenuLabel className='text-muted-foreground text-xs'>Switch Event</DropdownMenuLabel>
                {availableEvents.map((event) => (
                  <DropdownMenuItem
                    key={event.id}
                    onClick={() => {
                      setMenuOpen(false)
                      void navigate({ to: '/events/$eventSlug', params: { eventSlug: event.slug } })
                    }}
                    className='gap-2'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='truncate font-medium'>{event.name}</div>
                      {event.npo_name && (
                        <div className='text-muted-foreground truncate text-xs'>{event.npo_name}</div>
                      )}
                    </div>
                    {event.slug === selectedEventSlug && (
                      <Check className='size-4 shrink-0 text-primary' />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/settings'>
              <Settings className='mr-2 size-4' />
              Settings
            </Link>
          </DropdownMenuItem>
          {isSuperAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false)
                  // Small delay so dropdown closes before sheet opens
                  setTimeout(() => setSpoofSheetOpen(true), 150)
                }}
              >
                <Bug className='mr-2 size-4' />
                Debug Tools
                {isSpoofActive && (
                  <span className='ml-auto h-2 w-2 rounded-full bg-amber-400' />
                )}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <LogOut className='mr-2 size-4' />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />

      {isSuperAdmin && (
        <DebugSpoofSheet open={spoofSheetOpen} onOpenChange={setSpoofSheetOpen} />
      )}
    </>
  )
}
