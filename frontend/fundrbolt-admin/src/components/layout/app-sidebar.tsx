import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { LogoWhiteGold } from '@fundrbolt/shared/assets'
import { Building2, Calendar, LayoutDashboard, Users } from 'lucide-react'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { NpoSelector } from './NpoSelector'
import { EventSelector } from './EventSelector'
import type { NavGroup as NavGroupType } from './types'

// Map icon string names to lucide-react icon components
const iconMap = {
  LayoutDashboard,
  Building2,
  Calendar,
  Users,
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { navItems } = useRoleBasedNav()

  // Convert useRoleBasedNav items to sidebar structure
  const roleBasedNavGroup: NavGroupType = {
    title: 'General',
    items: navItems.map((item) => ({
      title: item.title,
      url: item.href,
      badge: typeof item.badge === 'number' ? String(item.badge) : item.badge,
      icon: item.icon ? iconMap[item.icon as keyof typeof iconMap] : undefined,
    })),
  }

  // Only show the role-based navigation group
  const filteredNavGroups = [roleBasedNavGroup]

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Fundrbolt Logo */}
        <div className='flex items-center justify-center px-4 py-2'>
          <img
            src={LogoWhiteGold}
            alt='Fundrbolt'
            className='h-8 w-auto'
          />
        </div>

        <NpoSelector />
        <EventSelector />
      </SidebarHeader>
      <SidebarContent>
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
