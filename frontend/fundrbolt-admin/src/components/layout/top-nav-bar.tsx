/**
 * TopNavBar
 * Horizontal navigation bar replacing the sidebar.
 *
 * Desktop: Logo | NPO selector | Event selector | Nav dropdowns | Search | Profile
 * Mobile:  Logo | Hamburger (sheet) | Search | Profile
 */
import { CommandMenu } from '@/components/command-menu'
import { ProfileDropdown } from '@/components/profile-dropdown'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InitialAvatar } from '@/components/ui/initial-avatar'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSearch } from '@/context/search-provider'
import { useEventContext } from '@/hooks/use-event-context'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { cn } from '@/lib/utils'
import { LogoWhiteGold } from '@fundrbolt/shared/assets'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  BarChart3,
  Building2,
  Calendar,
  Gavel,
  Menu,
  SearchIcon,
  Settings,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { iconMap } from './icon-map'

/** Map nav group titles to lucide icons for the trigger buttons */
const groupIconMap: Record<string, React.ElementType> = {
  Event: Calendar,
  Guests: Users,
  Auctions: Gavel,
  Data: BarChart3,
  Admin: Settings,
}

/* ─── NPO Selector (top-bar version) ─── */
function NpoDropdown() {
  const {
    selectedNpoId,
    selectedNpoName,
    availableNpos,
    selectNpo,
    isSingleNpoUser,
    canChangeNpo,
  } = useNpoContext()

  const selectedNpo = availableNpos.find((npo) => npo.id === selectedNpoId)
  const selectedNpoLogo = selectedNpo?.logo_url

  const npoIcon = (
    <div className='bg-primary/10 flex size-7 items-center justify-center overflow-hidden rounded'>
      {selectedNpoLogo ? (
        <img
          src={selectedNpoLogo}
          alt={selectedNpoName}
          className='size-full object-cover'
        />
      ) : (
        <Building2 className='size-4' />
      )}
    </div>
  )

  if (isSingleNpoUser && !canChangeNpo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='flex cursor-default items-center px-1'>
            {npoIcon}
          </div>
        </TooltipTrigger>
        <TooltipContent side='bottom'>
          <p>{selectedNpoName}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
            >
              {npoIcon}
              <span className='sr-only'>
                {selectedNpoName || 'Select NPO'}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side='bottom'>
          <p>{selectedNpoName || 'Select NPO'}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='start' className='min-w-52'>
        <DropdownMenuLabel className='text-muted-foreground text-xs'>
          Organizations
        </DropdownMenuLabel>
        {availableNpos.map((npo) => (
          <DropdownMenuItem
            key={npo.id || 'platform'}
            onClick={() => selectNpo(npo.id, npo.name)}
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
            <div className='flex-1'>
              <div className='font-medium'>{npo.name}</div>
              {npo.id === null && (
                <div className='text-muted-foreground text-xs'>
                  View all organizations
                </div>
              )}
            </div>
            {selectedNpoId === npo.id && (
              <span className='text-primary text-xs'>✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ─── Event Selector (top-bar version) ─── */
function EventDropdown() {
  const {
    selectedEventId,
    selectedEventName,
    availableEvents,
    isLoading,
    selectEvent,
    isEventSelected,
    shouldShowSearch,
  } = useEventContext()

  const [searchQuery, setSearchQuery] = useState('')

  const filteredEvents =
    shouldShowSearch && searchQuery
      ? availableEvents.filter((event) =>
        event.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      : availableEvents

  if (!isLoading && availableEvents.length === 0) {
    return (
      <div className='text-muted-foreground flex items-center gap-2 px-2 text-sm'>
        <Calendar className='size-3.5' />
        <span>No Events</span>
      </div>
    )
  }

  const eventIcon = (
    <div className='bg-accent flex size-7 items-center justify-center overflow-hidden rounded'>
      {isEventSelected ? (
        <InitialAvatar
          name={selectedEventName || 'Event'}
          brandingPrimaryColor={null}
          size='sm'
          className='h-full w-full rounded'
        />
      ) : (
        <Calendar className='size-4' />
      )}
    </div>
  )

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
            >
              {eventIcon}
              <span className='sr-only'>
                {selectedEventName || 'Select Event'}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side='bottom'>
          <p>{selectedEventName || 'Select Event'}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='start' className='min-w-56 p-0'>
        {shouldShowSearch ? (
          <Command>
            <CommandInput
              placeholder='Search events...'
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No events found.</CommandEmpty>
              <CommandGroup>
                {filteredEvents.map((event) => (
                  <CommandItem
                    key={event.id}
                    onSelect={() => {
                      selectEvent(event.id, event.name, event.slug)
                      setSearchQuery('')
                    }}
                    className='gap-2 p-2'
                  >
                    <EventRow
                      event={event}
                      isSelected={selectedEventId === event.id}
                    />
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
                onClick={() => selectEvent(event.id, event.name, event.slug)}
                className='gap-2 p-2'
              >
                <EventRow
                  event={event}
                  isSelected={selectedEventId === event.id}
                />
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EventRow({
  event,
  isSelected,
}: {
  event: { id: string; name: string; status: string }
  isSelected: boolean
}) {
  return (
    <>
      <div className='flex size-6 items-center justify-center overflow-hidden rounded-sm border'>
        <InitialAvatar
          name={event.name}
          brandingPrimaryColor={null}
          size='sm'
          className='h-full w-full rounded-sm'
        />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{event.name}</div>
        <div className='text-muted-foreground text-xs'>
          {event.status === 'active' && '🟢 Active'}
          {event.status === 'draft' && '📝 Draft'}
          {event.status === 'closed' && '🔒 Closed'}
        </div>
      </div>
      {isSelected && <span className='text-primary text-xs'>✓</span>}
    </>
  )
}

/* ─── Desktop Navigation Dropdowns ─── */
function DesktopNav() {
  const { navItems, eventNavGroups } = useRoleBasedNav()
  const href = useLocation({ select: (l) => l.href })

  // Combine admin items as a flat group
  const adminGroup = {
    title: 'Admin',
    items: navItems.map((item) => ({
      title: item.title,
      href: item.href,
      icon: item.icon,
      badge: item.badge,
      description: item.description,
    })),
  }

  const allGroups = [
    ...eventNavGroups.map((g) => ({
      title: g.title,
      items: g.items.map((i) => ({
        title: i.title,
        href: i.href,
        icon: i.icon,
        badge: i.badge,
      })),
    })),
    adminGroup,
  ]

  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        {allGroups.map((group) => (
          <NavigationMenuItem key={group.title}>
            <NavigationMenuTrigger className='h-8 gap-1.5 px-3 text-sm'>
              {groupIconMap[group.title] &&
                (() => {
                  const GroupIcon = groupIconMap[group.title]
                  return <GroupIcon className='size-4' />
                })()}
              {group.title}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className='grid w-48 gap-0.5 p-1'>
                {group.items.map((item) => {
                  const Icon = item.icon
                    ? iconMap[item.icon as keyof typeof iconMap]
                    : undefined
                  const isActive = href.startsWith(item.href)
                  return (
                    <li key={item.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-sm px-3 py-2.5 text-sm transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            isActive &&
                            'bg-accent/50 text-accent-foreground font-medium'
                          )}
                        >
                          {Icon && (
                            <Icon className='text-muted-foreground size-5' />
                          )}
                          <span className='text-center leading-tight'>{item.title}</span>
                          {item.badge != null && (
                            <span className='text-muted-foreground text-xs tabular-nums'>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </NavigationMenuLink>
                    </li>
                  )
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

/* ─── Mobile Sheet Nav ─── */
function MobileNav() {
  const { navItems, eventNavGroups } = useRoleBasedNav()
  const { selectedNpoName } = useNpoContext()
  const { selectedEventName } = useEventContext()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const href = useLocation({ select: (l) => l.href })

  const allGroups = [
    ...eventNavGroups.map((g) => ({
      title: g.title,
      items: g.items.map((i) => ({
        title: i.title,
        href: i.href,
        icon: i.icon,
        badge: i.badge,
      })),
    })),
    {
      title: 'Admin',
      items: navItems.map((item) => ({
        title: item.title,
        href: item.href,
        icon: item.icon,
        badge: item.badge,
      })),
    },
  ]

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant='ghost' size='icon' className='md:hidden'>
          <Menu className='size-5' />
          <span className='sr-only'>Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side='left' className='w-72 p-0'>
        <SheetHeader className='border-b px-4 py-3'>
          <SheetTitle className='flex items-center gap-2'>
            <img src={LogoWhiteGold} alt='Fundrbolt' className='h-6 w-auto' />
          </SheetTitle>
        </SheetHeader>

        {/* Context selectors */}
        <div className='space-y-3 border-b px-4 py-3'>
          <div className='flex items-center gap-3'>
            <NpoDropdown />
            <div className='flex flex-col'>
              <span className='text-muted-foreground text-xs font-medium uppercase'>
                Organization
              </span>
              <span className='max-w-40 truncate text-sm'>
                {selectedNpoName || 'Select NPO'}
              </span>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <EventDropdown />
            <div className='flex flex-col'>
              <span className='text-muted-foreground text-xs font-medium uppercase'>
                Event
              </span>
              <span className='max-w-40 truncate text-sm'>
                {selectedEventName || 'Select Event'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation groups */}
        <nav className='flex-1 overflow-y-auto px-2 py-2'>
          {allGroups.map((group) => {
            const GroupIcon = groupIconMap[group.title]
            return (
              <div key={group.title} className='mb-3'>
                <div className='text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-wider uppercase'>
                  {GroupIcon && <GroupIcon className='size-3.5' />}
                  {group.title}
                </div>
                <ul className='space-y-0.5'>
                  {group.items.map((item) => {
                    const Icon = item.icon
                      ? iconMap[item.icon as keyof typeof iconMap]
                      : undefined
                    const isActive = href.startsWith(item.href)
                    return (
                      <li key={item.href}>
                        <button
                          type='button'
                          onClick={() => {
                            navigate({ to: item.href })
                            setOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            isActive &&
                            'bg-accent text-accent-foreground font-medium'
                          )}
                        >
                          {Icon && (
                            <Icon className='text-muted-foreground size-4' />
                          )}
                          <span className='flex-1 text-left'>{item.title}</span>
                          {item.badge != null && (
                            <span className='text-muted-foreground text-xs tabular-nums'>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

/* ─── Search Button ─── */
function SearchButton() {
  const { setOpen } = useSearch()
  return (
    <Button
      variant='ghost'
      size='icon'
      className='size-8'
      onClick={() => setOpen(true)}
    >
      <SearchIcon className='size-4' />
      <span className='sr-only'>Search</span>
    </Button>
  )
}

/* ─── Main TopNavBar ─── */
export function TopNavBar() {
  return (
    <header className='bg-background sticky top-0 z-50 w-full border-b'>
      <div className='flex h-14 items-center gap-2 px-4'>
        {/* Mobile hamburger */}
        <MobileNav />

        {/* Logo */}
        <Link to='/' className='flex items-center'>
          <img src={LogoWhiteGold} alt='Fundrbolt' className='h-7 w-auto' />
        </Link>

        {/* Separator */}
        <div className='bg-border mx-1 hidden h-6 w-px md:block' />

        {/* NPO & Event selectors — hidden on mobile (in sheet instead) */}
        <div className='hidden items-center gap-1 md:flex'>
          <NpoDropdown />
          <EventDropdown />
        </div>

        {/* Separator */}
        <div className='bg-border mx-1 hidden h-6 w-px md:block' />

        {/* Desktop nav dropdowns */}
        <div className='hidden md:flex'>
          <DesktopNav />
        </div>

        {/* Spacer */}
        <div className='flex-1' />

        {/* Right side: Search + Profile */}
        <div className='flex items-center gap-1'>
          <SearchButton />
          <ProfileDropdown />
        </div>
      </div>

      {/* Command menu dialog (Cmd+K) */}
      <CommandMenu />
    </header>
  )
}
