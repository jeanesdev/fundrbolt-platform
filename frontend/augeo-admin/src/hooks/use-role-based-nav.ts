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

import { useAuth } from './use-auth'

export interface NavItem {
  title: string
  href: string
  icon?: string
  isActive?: boolean
  disabled?: boolean
  badge?: string | number
  description?: string
}

export interface UseRoleBasedNavReturn {
  navItems: NavItem[]
  canAccessNpos: boolean
  canAccessEvents: boolean
  canAccessUsers: boolean
  canModifyNpos: boolean
  canModifyEvents: boolean
  canModifyUsers: boolean
}

export function useRoleBasedNav(): UseRoleBasedNavReturn {
  const { role, isSuperAdmin, isNpoAdmin, isEventCoordinator, isStaff } = useAuth()

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
      title: 'NPOs',
      href: '/npos',
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
      href: '/npos',
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
      href: '/npos',
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
      href: '/npos',
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

  return {
    navItems,
    canAccessNpos,
    canAccessEvents,
    canAccessUsers,
    canModifyNpos,
    canModifyEvents,
    canModifyUsers,
  }
}
