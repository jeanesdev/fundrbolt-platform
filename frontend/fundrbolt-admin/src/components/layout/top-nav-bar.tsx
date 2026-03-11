/**
 * TopNavBar
 * Horizontal navigation bar replacing the sidebar.
 *
 * Desktop: Logo | Nav dropdowns | Search | Profile
 * Mobile:  Logo | Hamburger (sheet) | Search | Profile
 */
import { useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { LogoWhiteGold } from '@fundrbolt/shared/assets'
import {
  BarChart3,
  Calendar,
  Gavel,
  Menu,
  SearchIcon,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { Button } from '@/components/ui/button'
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
import { CommandMenu } from '@/components/command-menu'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { iconMap } from './icon-map'

/** Map nav group titles to lucide icons for the trigger buttons */
const groupIconMap: Record<string, React.ElementType> = {
  Event: Calendar,
  Guests: Users,
  Auctions: Gavel,
  Data: BarChart3,
  Admin: Settings,
}

/* ─── Desktop Navigation Dropdowns ─── */
function DesktopNav() {
  const { navItems, eventNavGroups } = useRoleBasedNav()
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
    adminGroup,
  ]

  return (
    <NavigationMenu
      viewport={false}
      value={openNav}
      onValueChange={(v) => {
        if (v) setOpenNav(v)
      }}
    >
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
  const { navItems, eventNavGroups } = useRoleBasedNav()
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
