/**
 * useRoleBasedNav Hook
 *
 * Provides navigation items filtered by user role.
 * Ensures users only see menu items they have permission to access.
 *
 * Navigation items by role:
 * - super_admin: All items
 * - npo_admin: Dashboard, NPOs (own), Events (own), Users (own NPO)
 * - event_coordinator: Dashboard, NPOs (read-only), Events (assigned), Users (event users, read-only)
 * - staff: Dashboard, NPO (read-only), Events (assigned), Users (event users, read-only)
 */
import type { EventStats } from '@/types/event'
import { useAuth } from './use-auth'
import { useEventContext } from './use-event-context'
import { useEventStats } from './use-event-stats'
import { useNpoContext } from './use-npo-context'

export interface NavItem {
  title: string
  href: string
  icon?: string
  isActive?: boolean
  disabled?: boolean
  badge?: string | number
  description?: string
}

export interface EventNavItem {
  title: string
  href: string
  icon: string
  badge?: string | number
}

export interface UseRoleBasedNavReturn {
  navItems: NavItem[]
  eventNavItems: EventNavItem[]
  eventNavTitle: string | null
  canAccessNpos: boolean
  canAccessEvents: boolean
  canAccessUsers: boolean
  canModifyNpos: boolean
  canModifyEvents: boolean
  canModifyUsers: boolean
}

export function useRoleBasedNav(): UseRoleBasedNavReturn {
  const { role, isSuperAdmin, isNpoAdmin, isEventCoordinator, isStaff } =
    useAuth()
  const { selectedNpoId } = useNpoContext()
  const { selectedEventId, selectedEventSlug, selectedEventName } =
    useEventContext()
  const { data: eventStats } = useEventStats(selectedEventId)

  // Determine NPO link based on selected NPO
  const npoHref = selectedNpoId ? `/npos/${selectedNpoId}` : '/npos'
  // Change title based on whether specific NPO is selected
  const npoTitle = selectedNpoId ? 'NPO' : 'NPOs'

  // Base navigation items available to all authenticated users
  const baseNavItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/',
      icon: 'LayoutDashboard',
      isActive: false,
    },
  ]

  // SuperAdmin sees everything
  const superAdminNavItems: NavItem[] = [
    ...baseNavItems,
    {
      title: npoTitle,
      href: npoHref,
      icon: 'Building2',
      description: 'Manage all nonprofit organizations',
    },
    {
      title: 'Events',
      href: '/events',
      icon: 'Calendar',
      description: 'View all fundraising events',
    },
    {
      title: 'Users',
      href: '/users',
      icon: 'Users',
      description: 'Manage platform users',
    },
  ]

  // NPO Admin sees their NPO, events, and users
  const npoAdminNavItems: NavItem[] = [
    ...baseNavItems,
    {
      title: 'My NPO',
      href: npoHref,
      icon: 'Building2',
      description: 'Manage your organization',
    },
    {
      title: 'Events',
      href: '/events',
      icon: 'Calendar',
      description: 'Manage your events',
    },
    {
      title: 'Users',
      href: '/users',
      icon: 'Users',
      description: 'Manage NPO users',
    },
  ]

  // Event Coordinator sees NPOs (read-only), events, and event users
  const eventCoordinatorNavItems: NavItem[] = [
    ...baseNavItems,
    {
      title: 'NPOs',
      href: npoHref,
      icon: 'Building2',
      description: 'View organizations (read-only)',
      badge: 'Read-only',
    },
    {
      title: 'Events',
      href: '/events',
      icon: 'Calendar',
      description: 'Manage your events',
    },
    {
      title: 'Users',
      href: '/users',
      icon: 'Users',
      description: 'View event users (read-only)',
      badge: 'Read-only',
    },
  ]

  // Staff sees NPO (read-only), events (assigned), and event users (read-only)
  const staffNavItems: NavItem[] = [
    ...baseNavItems,
    {
      title: 'My NPO',
      href: npoHref,
      icon: 'Building2',
      description: 'View your organization (read-only)',
      badge: 'Read-only',
    },
    {
      title: 'Events',
      href: '/events',
      icon: 'Calendar',
      description: 'Your assigned events',
    },
    {
      title: 'Users',
      href: '/users',
      icon: 'Users',
      description: 'View event users (read-only)',
      badge: 'Read-only',
    },
  ]

  // Select nav items based on role
  let navItems: NavItem[] = baseNavItems
  if (isSuperAdmin) {
    navItems = superAdminNavItems
  } else if (isNpoAdmin) {
    navItems = npoAdminNavItems
  } else if (isEventCoordinator) {
    navItems = eventCoordinatorNavItems
  } else if (isStaff) {
    navItems = staffNavItems
  }

  // Permission flags
  const canAccessNpos = role !== 'donor' // All admin roles can access NPOs
  const canAccessEvents = role !== 'donor' // All admin roles can access Events
  const canAccessUsers = role !== 'donor' && role !== 'staff' // Staff has limited user access

  const canModifyNpos = isSuperAdmin || isNpoAdmin
  const canModifyEvents = isSuperAdmin || isNpoAdmin || isEventCoordinator
  const canModifyUsers = isSuperAdmin || isNpoAdmin

  const eventNavItems: EventNavItem[] = selectedEventId
    ? EVENT_SECTION_CONFIG.map((section) => {
      const badgeValue = (() => {
        if (!eventStats) return undefined
        if (section.getBadgeValue) return section.getBadgeValue(eventStats)
        if (section.statKey) return eventStats[section.statKey]
        return undefined
      })()

      return {
        title: section.title,
        href: `/events/${selectedEventSlug || selectedEventId}/${section.path}`,
        icon: section.icon,
        badge: typeof badgeValue === 'number' ? badgeValue : undefined,
      }
    })
    : []

  const eventNavTitle = selectedEventId
    ? `Event${selectedEventName ? `: ${selectedEventName}` : ''}`
    : null

  return {
    navItems,
    eventNavItems,
    eventNavTitle,
    canAccessNpos,
    canAccessEvents,
    canAccessUsers,
    canModifyNpos,
    canModifyEvents,
    canModifyUsers,
  }
}

type EventStatKey = Exclude<keyof EventStats, 'event_id'>

const EVENT_SECTION_CONFIG: Array<{
  title: string
  path: string
  icon: EventNavItem['icon']
  statKey?: EventStatKey
  getBadgeValue?: (stats: EventStats) => number
}> = [
    { title: 'Details', path: 'details', icon: 'FileText' },
    { title: 'Media', path: 'media', icon: 'Image', statKey: 'media_count' },
    { title: 'Links', path: 'links', icon: 'Link2', statKey: 'links_count' },
    {
      title: 'Food Options',
      path: 'food',
      icon: 'Utensils',
      statKey: 'food_options_count',
    },
    {
      title: 'Registrations',
      path: 'registrations',
      icon: 'Users',
      getBadgeValue: (stats) =>
        stats.active_registrations_count + stats.active_guest_count,
    },
    { title: 'Seating', path: 'seating', icon: 'LayoutGrid' },
    { title: 'Tickets', path: 'tickets', icon: 'Ticket' },
    {
      title: 'Sponsors',
      path: 'sponsors',
      icon: 'Award',
      statKey: 'sponsors_count',
    },
    {
      title: 'Auction Items',
      path: 'auction-items',
      icon: 'Gavel',
      statKey: 'auction_items_count',
    },
  ]
