import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  LogOut,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import useDialogState from '@/hooks/use-dialog-state'
import { useEventContext } from '@/hooks/use-event-context'
import { useNpoContext } from '@/hooks/use-npo-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InitialAvatar } from '@/components/ui/initial-avatar'
import { DebugSpoofSheet } from '@/components/debug-spoof-sheet'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const navigate = useNavigate()
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore(
    (state) => state.getProfilePictureUrl
  )
  const {
    selectedEventId,
    selectedEventName,
    availableEvents,
    isLoading: isEventsLoading,
    selectEvent,
    shouldShowSearch,
  } = useEventContext()
  const {
    selectedNpoId,
    selectedNpoName,
    availableNpos,
    selectNpo,
    canChangeNpo,
    isFundrBoltPlatformView,
  } = useNpoContext()
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const [spoofSheetOpen, setSpoofSheetOpen] = useState(false)
  const [npoListOpen, setNpoListOpen] = useState(false)
  const [eventListOpen, setEventListOpen] = useState(false)

  const isSuperAdmin = user?.role === 'super_admin'

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

  const filteredEvents =
    shouldShowSearch && eventSearchQuery
      ? availableEvents.filter((event) =>
          event.name.toLowerCase().includes(eventSearchQuery.toLowerCase())
        )
      : availableEvents

  const handleSelectEvent = (event: {
    id: string
    name: string
    slug: string
  }) => {
    selectEvent(event.id, event.name, event.slug)
    setEventSearchQuery('')
    setEventListOpen(false)
    setMenuOpen(false)

    navigate({
      to: '/events/$eventId/dashboard',
      params: { eventId: event.id },
    })
  }

  return (
    <>
      <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src={profilePictureUrl || undefined}
                alt={user?.email || 'User'}
              />
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
                {user?.communications_email?.trim() ||
                  user?.email ||
                  'Not logged in'}
              </p>
              {timeBaseSpoofMs !== null && (
                <p className='text-xs leading-none text-amber-600'>
                  Debug time spoof active
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Context</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setNpoListOpen((v) => !v)
            }}
            className='gap-2'
          >
            <Building2 className='mr-2 size-4 shrink-0' />
            <div className='flex min-w-0 flex-1 flex-col text-left'>
              <span>NPO</span>
              <span className='text-muted-foreground truncate text-xs font-normal'>
                {selectedNpoName}
              </span>
            </div>
            {npoListOpen ? (
              <ChevronUp className='size-4 shrink-0' />
            ) : (
              <ChevronDown className='size-4 shrink-0' />
            )}
          </DropdownMenuItem>
          {npoListOpen && (
            <div className='border-muted ml-4 border-l-2 pl-2'>
              {availableNpos.length === 0 ? (
                <DropdownMenuItem disabled>
                  No organizations available
                </DropdownMenuItem>
              ) : (
                availableNpos.map((npo) => (
                  <DropdownMenuItem
                    key={npo.id || 'platform'}
                    disabled={!canChangeNpo && selectedNpoId !== npo.id}
                    onClick={() => {
                      selectNpo(npo.id, npo.name)
                      setNpoListOpen(false)
                      setMenuOpen(false)
                    }}
                    className='gap-2 p-2'
                  >
                    <div className='flex size-6 items-center justify-center overflow-hidden rounded-sm border'>
                      {npo.logo_url ? (
                        <img
                          src={npo.logo_url}
                          alt={npo.name}
                          className='size-full object-cover'
                        />
                      ) : (
                        <Building2 className='size-4 shrink-0' />
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate font-medium'>{npo.name}</div>
                      {npo.id === null && (
                        <div className='text-muted-foreground text-xs'>
                          {isFundrBoltPlatformView
                            ? 'All organizations'
                            : 'View all organizations'}
                        </div>
                      )}
                    </div>
                    {selectedNpoId === npo.id && (
                      <span className='text-primary text-xs'>✓</span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </div>
          )}
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
                {selectedEventName || 'Select Event'}
              </span>
            </div>
            {eventListOpen ? (
              <ChevronUp className='size-4 shrink-0' />
            ) : (
              <ChevronDown className='size-4 shrink-0' />
            )}
          </DropdownMenuItem>
          {eventListOpen && (
            <div className='border-muted ml-4 border-l-2 pl-2'>
              {isEventsLoading ? (
                <div className='px-3 py-2 text-sm'>Loading events...</div>
              ) : availableEvents.length === 0 ? (
                <div className='text-muted-foreground px-3 py-2 text-sm'>
                  No events available
                </div>
              ) : shouldShowSearch ? (
                <Command>
                  <CommandInput
                    placeholder='Search events...'
                    value={eventSearchQuery}
                    onValueChange={setEventSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>No events found.</CommandEmpty>
                    <CommandGroup>
                      {filteredEvents.map((event) => (
                        <CommandItem
                          key={event.id}
                          onSelect={() => handleSelectEvent(event)}
                          className='gap-2 p-2'
                        >
                          <div className='flex size-6 items-center justify-center overflow-hidden rounded-sm border'>
                            {event.logo_url ? (
                              <img
                                src={event.logo_url}
                                alt={event.name}
                                className='h-full w-full object-cover'
                              />
                            ) : (
                              <InitialAvatar
                                name={event.name}
                                brandingPrimaryColor={null}
                                size='sm'
                                className='h-full w-full rounded-sm'
                              />
                            )}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='truncate font-medium'>
                              {event.name}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {event.status === 'active' && '🟢 Active'}
                              {event.status === 'draft' && '📝 Draft'}
                              {event.status === 'closed' && '🔒 Closed'}
                            </div>
                          </div>
                          {selectedEventId === event.id && (
                            <span className='text-primary text-xs'>✓</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              ) : (
                <>
                  <DropdownMenuLabel className='text-muted-foreground px-2 py-1.5 text-xs'>
                    Select Event
                  </DropdownMenuLabel>
                  {availableEvents.map((event) => (
                    <DropdownMenuItem
                      key={event.id}
                      onClick={() => handleSelectEvent(event)}
                      className='gap-2 p-2'
                    >
                      <div className='flex size-6 items-center justify-center overflow-hidden rounded-sm border'>
                        {event.logo_url ? (
                          <img
                            src={event.logo_url}
                            alt={event.name}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <InitialAvatar
                            name={event.name}
                            brandingPrimaryColor={null}
                            size='sm'
                            className='h-full w-full rounded-sm'
                          />
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate font-medium'>{event.name}</div>
                        <div className='text-muted-foreground text-xs'>
                          {event.status === 'active' && '🟢 Active'}
                          {event.status === 'draft' && '📝 Draft'}
                          {event.status === 'closed' && '🔒 Closed'}
                        </div>
                      </div>
                      {selectedEventId === event.id && (
                        <span className='text-primary text-xs'>✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </div>
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
              <DropdownMenuLabel>Debug Tools</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false)
                  setSpoofSheetOpen(true)
                }}
              >
                <Clock className='mr-2 size-4' />
                {timeBaseSpoofMs !== null ? 'Update Spoof Time' : 'Spoof Time'}
                {timeBaseSpoofMs !== null && (
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
