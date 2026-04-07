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

export interface EventNavGroup {
  title: string
  items: EventNavItem[]
}

export interface UseRoleBasedNavReturn {
  navItems: NavItem[]
  eventNavItems: EventNavItem[]
  eventNavGroups: EventNavGroup[]
  eventNavTitle: string | null
  canAccessNpos: boolean
  canAccessEvents: boolean
  canAccessUsers: boolean
  canModifyNpos: boolean
  canModifyEvents: boolean
  canModifyUsers: boolean
}

export function useRoleBasedNav(): UseRoleBasedNavReturn {
  const {
    role,
    isSuperAdmin,
    isNpoAdmin,
    isEventCoordinator,
    isAuctioneer,
    isStaff,
  } = useAuth()
  const { selectedNpoId } = useNpoContext()
  const { selectedEventId, selectedEventName } = useEventContext()
  const { data: eventStats } = useEventStats(selectedEventId)

  // Determine NPO link based on selected NPO
  const npoHref = selectedNpoId ? `/npos/${selectedNpoId}` : '/npos'
  // Change title based on whether specific NPO is selected
  const npoTitle = selectedNpoId ? 'Organization' : 'Organizations'

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
      title: 'My Organization',
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
      title: 'Organizations',
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
      title: 'My Organization',
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

  // Auctioneer sees NPO (read-only), events (assigned), auction-focused
  const auctioneerNavItems: NavItem[] = [
    ...baseNavItems,
    {
      title: 'My Organization',
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
  ]

  // Select nav items based on role
  let navItems: NavItem[] = baseNavItems
  if (isSuperAdmin) {
    navItems = superAdminNavItems
  } else if (isNpoAdmin) {
    navItems = npoAdminNavItems
  } else if (isEventCoordinator) {
    navItems = eventCoordinatorNavItems
  } else if (isAuctioneer) {
    navItems = auctioneerNavItems
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

  const buildEventNavItem = (
    section: (typeof EVENT_SECTION_CONFIG)[number]
  ): EventNavItem => {
    const badgeValue = (() => {
      if (!eventStats) return undefined
      if (section.getBadgeValue) return section.getBadgeValue(eventStats)
      if (section.statKey) return eventStats[section.statKey]
      return undefined
    })()

    return {
      title: section.title,
      href: `/events/${selectedEventId}/${section.path}`,
      icon: section.icon,
      badge: typeof badgeValue === 'number' ? badgeValue : undefined,
    }
  }

  // Flat list (backward compat)
  const eventNavItems: EventNavItem[] = selectedEventId
    ? EVENT_SECTION_CONFIG.map(buildEventNavItem)
    : []

  // Grouped nav: Event, Guests, Auctions
  const eventNavGroups: EventNavGroup[] = selectedEventId
    ? EVENT_NAV_GROUPS.filter((group) => {
        // Only show Auctioneer section for auctioneers and super admins
        if (group.title === 'Auctioneer') {
          return isAuctioneer || isSuperAdmin
        }
        return true
      }).map((group) => ({
        title: group.title,
        items: group.sections.map(buildEventNavItem),
      }))
    : []

  const eventNavTitle = selectedEventId
    ? `Event${selectedEventName ? `: ${selectedEventName}` : ''}`
    : null

  return {
    navItems,
    eventNavItems,
    eventNavGroups,
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

type EventSectionConfig = {
  title: string
  path: string
  icon: EventNavItem['icon']
  statKey?: EventStatKey
  getBadgeValue?: (stats: EventStats) => number
}

const EVENT_SECTION_CONFIG: EventSectionConfig[] = [
  { title: 'Event Dashboard', path: 'dashboard', icon: 'BarChart3' },
  { title: 'Donor Dashboard', path: 'donor-dashboard', icon: 'HeartHandshake' },
  { title: 'Details', path: 'details', icon: 'FileText' },
  { title: 'Planning Checklist', path: 'checklist', icon: 'ClipboardList' },
  { title: 'Preview', path: 'preview', icon: 'Eye' },
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
  { title: 'Check-in', path: 'checkin', icon: 'ClipboardCheck' },
  { title: 'Seating', path: 'seating', icon: 'LayoutGrid' },
  { title: 'Tickets', path: 'tickets', icon: 'Ticket' },
  {
    title: 'Ticket Sales',
    path: 'tickets/sales',
    icon: 'Receipt',
  },
  {
    title: 'Promo Codes',
    path: 'tickets/promos',
    icon: 'Tag',
  },
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
  {
    title: 'Auction Bids',
    path: 'auction-bids',
    icon: 'HandCoins',
  },
  {
    title: 'Quick Entry',
    path: 'quick-entry',
    icon: 'Zap',
  },
  {
    title: 'Notifications',
    path: 'notifications',
    icon: 'Bell',
  },
  {
    title: 'Payments',
    path: 'payments',
    icon: 'CreditCard',
  },
  {
    title: 'Auctioneer',
    path: 'auctioneer',
    icon: 'Gavel',
  },
]

/** Helper to look up a section by its path. Throws at startup if a path is missing. */
function sectionByPath(path: string): EventSectionConfig {
  const section = EVENT_SECTION_CONFIG.find((s) => s.path === path)
  if (!section) throw new Error(`EVENT_SECTION_CONFIG missing path: ${path}`)
  return section
}

/**
 * Narrative-driven event nav groups:
 * - Event: What is this event? Setup & configuration
 * - Guests: Who's coming? People management
 * - Auctions: The main fundraising event
 */
const EVENT_NAV_GROUPS: Array<{
  title: string
  sections: EventSectionConfig[]
}> = [
  {
    title: 'Event',
    sections: [
      sectionByPath('details'),
      sectionByPath('checklist'),
      sectionByPath('preview'),
      sectionByPath('media'),
      sectionByPath('links'),
      sectionByPath('food'),
      sectionByPath('tickets'),
      sectionByPath('tickets/sales'),
      sectionByPath('tickets/promos'),
      sectionByPath('sponsors'),
      sectionByPath('notifications'),
    ],
  },
  {
    title: 'Guests',
    sections: [
      sectionByPath('registrations'),
      sectionByPath('checkin'),
      sectionByPath('seating'),
    ],
  },
  {
    title: 'Auctions',
    sections: [
      sectionByPath('auction-items'),
      sectionByPath('auction-bids'),
      sectionByPath('quick-entry'),
    ],
  },
  {
    title: 'Finance',
    sections: [sectionByPath('payments')],
  },
  {
    title: 'Data',
    sections: [sectionByPath('dashboard'), sectionByPath('donor-dashboard')],
  },
  {
    title: 'Auctioneer',
    sections: [sectionByPath('auctioneer')],
  },
]
