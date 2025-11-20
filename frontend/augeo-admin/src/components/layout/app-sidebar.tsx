import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { Building2, Calendar, LayoutDashboard, Users } from 'lucide-react'
import { useRoleBasedNav } from '@/hooks/use-role-based-nav'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { NpoSelector } from './NpoSelector'
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
        <NpoSelector />

        {/* NpoSelector replaces TeamSwitcher for NPO context selection */}
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
