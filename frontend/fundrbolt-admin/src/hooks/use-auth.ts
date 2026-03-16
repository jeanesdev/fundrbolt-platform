/**
 * useAuth Hook
 * Provides convenient access to current user authentication and role information
 *
 * Role hierarchy:
 * - super_admin: FundrBolt platform staff with full access
 * - npo_admin: Full management within assigned NPO(s)
 * - event_coordinator: Event/auction management within NPO
 * - staff: Donor registration/check-in within assigned events
 * - donor: Default role for brand new users and donor-portal users
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
  email_verified: boolean
  role: string
  npo_memberships: {
    npo_id: string
    npo_name: string
    role: string
    status: string
  }[]
}

export interface UseAuthReturn {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  role: UserRole | null
  npoId: string | null
  npoMemberships: AuthUser['npo_memberships']
  emailVerified: boolean

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
  const npoMemberships = user?.npo_memberships || []
  const npoId = npoMemberships.length === 1 ? npoMemberships[0].npo_id : null
  const emailVerified = user?.email_verified ?? false

  // Role checks
  const isSuperAdmin = role === 'super_admin'
  const isNpoAdmin = role === 'npo_admin'
  const isEventCoordinator = role === 'event_coordinator'
  const isStaff = role === 'staff'
  const isDonor = role === 'donor'

  // Brand-new users may still be donors until they join or create an NPO.
  const canAccessAdminPWA =
    isAuthenticated && (!isDonor || npoMemberships.length === 0)

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
    npoMemberships,
    emailVerified,
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
