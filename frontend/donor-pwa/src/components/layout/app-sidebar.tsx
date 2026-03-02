import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { LogoNavyGold } from '@fundrbolt/shared/assets'
import { Settings, User } from 'lucide-react'
import { sidebarData } from './data/sidebar-data'
import { EventSelector } from './EventSelector'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import type { NavGroup as NavGroupType } from './types'

/**
 * Donor PWA Sidebar
 *
 * Simplified sidebar for donors:
 * - Event selector dropdown (shows registered events)
 * - Settings navigation only (profile, password, consent)
 * - No dashboard, no NPO management, no user management
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()

  // Donor PWA only shows settings navigation
  const donorNavGroup: NavGroupType = {
    title: 'Account',
    items: [
      {
        title: 'Profile',
        url: '/settings',
        icon: User,
      },
      {
        title: 'Settings',
        url: '/settings/password',
        icon: Settings,
      },
    ],
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/* Fundrbolt Logo */}
        <div className='flex items-center justify-center px-4 py-2'>
          <img
            src={LogoNavyGold}
            alt='Fundrbolt'
            className='h-8 w-auto'
          />
        </div>

        <EventSelector />
      </SidebarHeader>
      <SidebarContent>
        <NavGroup {...donorNavGroup} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
