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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useEventContextStore } from '@/stores/event-context-store'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Bug,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Settings,
} from 'lucide-react'
import { useState } from 'react'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [eventListOpen, setEventListOpen] = useState(false)
  const [spoofSheetOpen, setSpoofSheetOpen] = useState(false)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore(
    (state) => state.getProfilePictureUrl
  )
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const availableEvents = useEventContextStore((state) => state.availableEvents)
  const selectedEventSlug = useEventContextStore(
    (state) => state.selectedEventSlug
  )
  const isSuperAdmin = user?.role === 'super_admin'
  const displayEmail =
    user?.communications_email?.trim() || user?.email || 'Not logged in'

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

  const isSpoofActive =
    isSuperAdmin && (!!spoofedUser || timeBaseSpoofMs !== null)

  return (
    <>
      <DropdownMenu
        modal={false}
        open={!!menuOpen}
        onOpenChange={(v) => {
          setMenuOpen(v)
          if (!v) setEventListOpen(false)
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src={profilePictureUrl || undefined}
                alt={displayEmail}
              />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {isSpoofActive && (
              <span className='absolute -top-0.5 -right-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-amber-400' />
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
                {displayEmail}
              </p>
              {spoofedUser?.label && (
                <p className='text-xs leading-none text-amber-600'>
                  Spoofing: {spoofedUser.label}
                </p>
              )}
              {(spoofedUser || timeBaseSpoofMs !== null) && (
                <p className='text-xs leading-none text-amber-600'>
                  Debug spoof active
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableEvents.length > 0 && (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  setEventListOpen((v) => !v)
                }}
                className='gap-2'
              >
                <Calendar className='mr-2 size-4 shrink-0' />
                <div className='flex min-w-0 flex-1 flex-col text-left'>
                  <span>Event</span>
                  <span className='text-muted-foreground truncate text-xs font-normal'>
                    {availableEvents.find((e) => e.slug === selectedEventSlug)
                      ?.name ?? 'Select Event'}
                  </span>
                </div>
                {eventListOpen ? (
                  <ChevronUp className='text-muted-foreground size-4 shrink-0' />
                ) : (
                  <ChevronDown className='text-muted-foreground size-4 shrink-0' />
                )}
              </DropdownMenuItem>
              {eventListOpen && (
                <div className='border-muted ml-4 border-l-2 pl-2'>
                  {availableEvents.map((event) => (
                    <DropdownMenuItem
                      key={event.id}
                      onClick={() => {
                        setMenuOpen(false)
                        void navigate({
                          to: '/events/$slug',
                          params: { slug: event.slug },
                        })
                      }}
                      className='gap-2'
                    >
                      <div className='min-w-0 flex-1'>
                        <div className='truncate font-medium'>{event.name}</div>
                        {event.npo_name && (
                          <div className='text-muted-foreground truncate text-xs'>
                            {event.npo_name}
                          </div>
                        )}
                      </div>
                      {event.slug === selectedEventSlug && (
                        <Check className='text-primary size-4 shrink-0' />
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </>
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
        <DebugSpoofSheet
          open={spoofSheetOpen}
          onOpenChange={setSpoofSheetOpen}
        />
      )}
    </>
  )
}
