import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { LogoWhiteGold } from '@fundrbolt/shared/assets'
import { EventSelector } from './EventSelector'
import { NpoSelector } from './NpoSelector'
import { iconMap } from './icon-map'
import { NavGroup } from './nav-group'
import { SidebarSearch } from './sidebar-search'
import type { NavGroup as NavGroupType } from './types'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { navItems, eventNavGroups } = useRoleBasedNav()

  const hasEventGroups = eventNavGroups.length > 0

  // Convert useRoleBasedNav items to sidebar structure
  const adminNavGroup: NavGroupType = {
    title: 'Admin',
    // Only collapse Admin when event groups are visible
    defaultCollapsed: hasEventGroups,
    items: navItems.map((item) => ({
      title: item.title,
      url: item.href,
      badge: typeof item.badge === 'number' ? String(item.badge) : item.badge,
      icon: item.icon ? iconMap[item.icon as keyof typeof iconMap] : undefined,
    })),
  }

  const orderedNavGroups: NavGroupType[] = []

  // Add event nav groups (Event, Guests, Auctions)
  if (hasEventGroups) {
    for (const group of eventNavGroups) {
      orderedNavGroups.push({
        title: group.title,
        items: group.items.map((item) => ({
          title: item.title,
          url: item.href,
          badge:
            typeof item.badge === 'number' ? String(item.badge) : item.badge,
          icon: item.icon
            ? iconMap[item.icon as keyof typeof iconMap]
            : undefined,
        })),
      })
    }
  }

  orderedNavGroups.push(adminNavGroup)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Fundrbolt Logo */}
        <div className='flex items-center justify-center px-4 py-2'>
          <img src={LogoWhiteGold} alt='Fundrbolt' className='h-8 w-auto' />
        </div>

        <NpoSelector />
        <EventSelector />
        <SidebarSearch navGroups={orderedNavGroups} />
      </SidebarHeader>
      <SidebarContent>
        {orderedNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
