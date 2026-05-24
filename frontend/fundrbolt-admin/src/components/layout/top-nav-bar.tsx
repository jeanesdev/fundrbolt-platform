/**
 * TopNavBar
 * Horizontal navigation bar replacing the sidebar.
 *
 * Desktop: Logo | Nav dropdowns | Search | Profile
 * Mobile:  Logo | Hamburger (sheet) | Search | Profile
 */
import { CommandMenu } from '@/components/command-menu'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSearch } from '@/context/search-provider'
import { useEventContext } from '@/hooks/use-event-context'
import { useNpoContext } from '@/hooks/use-npo-context'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { cn } from '@/lib/utils'
import LogoWhiteGoldPng from '@fundrbolt/shared/assets/logos/fundrbolt-logo-white-gold.png'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  BarChart3,
  Calendar,
  CreditCard,
  Gavel,
  Heart,
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
  Finance: CreditCard,
  Data: BarChart3,
  Auctioneer: Gavel,
  Donate: Heart,
  Admin: Settings,
}

/* ─── Desktop Navigation Dropdowns ─── */
function DesktopNav() {
  const { navItems, eventNavGroups, donateNowNavGroup } = useRoleBasedNav()
  const href = useLocation({ select: (l) => l.href })
  const [openNav, setOpenNav] = useState('')
  const [prevHref, setPrevHref] = useState(href)

  // Reset dropdown when the route changes (derived state during render)
  if (prevHref !== href) {
    setPrevHref(href)
    setOpenNav('')
  }

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
    ...(donateNowNavGroup
      ? [
        {
          title: donateNowNavGroup.title,
          items: donateNowNavGroup.items.map((i) => ({
            title: i.title,
            href: i.href,
            icon: i.icon,
            badge: i.badge,
          })),
        },
      ]
      : []),
    adminGroup,
  ]

  return (
    <NavigationMenu viewport={false} value={openNav} onValueChange={setOpenNav}>
      <NavigationMenuList>
        {allGroups.map((group) => (
          <NavigationMenuItem key={group.title} value={group.title}>
            <NavigationMenuTrigger className='h-8 gap-1.5 px-3 text-sm'>
              {groupIconMap[group.title] &&
                (() => {
                  const GroupIcon = groupIconMap[group.title]
                  return <GroupIcon className='size-4' />
                })()}
              {group.title}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className='grid max-h-[70vh] w-48 gap-0.5 overflow-y-auto p-1'>
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
                          <span className='text-center leading-tight'>
                            {item.title}
                          </span>
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
  const { navItems, eventNavGroups, donateNowNavGroup } = useRoleBasedNav()
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
    ...(donateNowNavGroup
      ? [
        {
          title: donateNowNavGroup.title,
          items: donateNowNavGroup.items.map((i) => ({
            title: i.title,
            href: i.href,
            icon: i.icon,
            badge: i.badge,
          })),
        },
      ]
      : []),
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
            <img
              src={LogoWhiteGoldPng}
              alt='FundrBolt'
              className='h-6 w-auto'
            />
          </SheetTitle>
        </SheetHeader>

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

/* ─── Event Chip ─── */
function EventChip() {
  const href = useLocation({ select: (l) => l.href })
  const { availableEvents, selectedEventId } = useEventContext()
  const { availableNpos } = useNpoContext()

  // Extract event ID/slug from the URL path (e.g. /events/abc-123/auctioneer/)
  const urlEventId = href.match(/\/events\/([^/]+)/)?.[1] ?? null

  // Prefer the event the user is currently viewing (from URL), fall back to selected
  const effectiveEventId = urlEventId || selectedEventId
  const selectedEvent = availableEvents.find(
    (e) => e.id === effectiveEventId || e.slug === effectiveEventId
  )

  // Only show when inside an event route with a known event
  if (!urlEventId || !selectedEvent) return null

  const logoUrl = selectedEvent.logo_url ?? null
  const selectedNpo = availableNpos.find(
    (npo) => npo.id === selectedEvent.npo_id
  )
  const npoIconUrl = selectedNpo?.icon_url ?? null
  const tooltipText = [
    selectedEvent.name,
    selectedEvent.npo_name,
    selectedEvent.status
      ? selectedEvent.status.charAt(0).toUpperCase() +
      selectedEvent.status.slice(1)
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className='flex items-center gap-2'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='flex h-7 w-7 shrink-0 cursor-default items-center justify-center overflow-hidden rounded-md border border-white/20'>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={selectedEvent.name}
                  className='h-full w-full object-cover'
                />
              ) : npoIconUrl ? (
                <img
                  src={npoIconUrl}
                  alt={selectedNpo?.name ?? selectedEvent.name}
                  className='h-full w-full object-cover'
                />
              ) : (
                <InitialAvatar
                  name={selectedEvent.name}
                  brandingPrimaryColor={
                    (selectedEvent as { primary_color?: string | null })
                      .primary_color ?? undefined
                  }
                  size='sm'
                  className='h-full w-full rounded-md'
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side='bottom'>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
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
        <Link to='/' className='flex shrink-0 items-center'>
          <img
            src={LogoWhiteGoldPng}
            alt='FundrBolt'
            className='h-7 w-auto shrink-0'
          />
        </Link>

        {/* Separator */}
        <div className='bg-border mx-1 hidden h-6 w-px md:block' />

        {/* Event context chip */}
        <EventChip />

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
