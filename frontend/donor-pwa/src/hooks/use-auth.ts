/**
 * useAuth Hook
 * Provides convenient access to current user authentication and role information
 *
 * Role hierarchy:
 * - super_admin: Fundrbolt platform staff with full access
 * - npo_admin: Full management within assigned NPO(s)
 * - event_coordinator: Event/auction management within NPO
 * - staff: Donor registration/check-in within assigned events
 * - donor: Bidding and profile management only (NOT allowed in admin PWA)
 */

import { useAuthStore } from '@/stores/auth-store'

export type UserRole =
  | 'super_admin'
  | 'npo_admin'
  | 'event_coordinator'
  | 'staff'
  | 'donor'

interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  npo_id: string | null
}

export interface UseAuthReturn {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole | null
  npoId: string | null

  // Role checks
  isSuperAdmin: boolean
  isNpoAdmin: boolean
  isEventCoordinator: boolean
  isStaff: boolean
  isDonor: boolean

  // Helper methods
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  canAccessAdminPWA: boolean
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  const role = user?.role as UserRole | null
  const npoId = user?.npo_id || null

  // Role checks
  const isSuperAdmin = role === 'super_admin'
  const isNpoAdmin = role === 'npo_admin'
  const isEventCoordinator = role === 'event_coordinator'
  const isStaff = role === 'staff'
  const isDonor = role === 'donor'

  // Donor role is NOT allowed in admin PWA
  const canAccessAdminPWA = isAuthenticated && !isDonor

  // Helper methods
  const hasRole = (checkRole: UserRole): boolean => {
    return role === checkRole
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return role !== null && roles.includes(role)
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    role,
    npoId,
    isSuperAdmin,
    isNpoAdmin,
    isEventCoordinator,
    isStaff,
    isDonor,
    hasRole,
    hasAnyRole,
    canAccessAdminPWA,
  }
}
