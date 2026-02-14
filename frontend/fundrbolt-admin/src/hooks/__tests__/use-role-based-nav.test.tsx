import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../use-auth'
import { useEventContext } from '../use-event-context'
import { useEventStats } from '../use-event-stats'
import { useNpoContext } from '../use-npo-context'
import { useRoleBasedNav } from '../use-role-based-nav'

vi.mock('../use-auth')
vi.mock('../use-npo-context')
vi.mock('../use-event-context')
vi.mock('../use-event-stats')

describe('useRoleBasedNav', () => {
  const mockUseAuth = vi.mocked(useAuth)
  const mockUseNpoContext = vi.mocked(useNpoContext)
  const mockUseEventContext = vi.mocked(useEventContext)
  const mockUseEventStats = vi.mocked(useEventStats)

  let queryClient: QueryClient

  const createWrapper = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return wrapper
  }

  const buildAuthMock = (
    overrides: Partial<ReturnType<typeof useAuth>> = {}
  ): ReturnType<typeof useAuth> =>
    ({
      role: 'super_admin',
      isSuperAdmin: true,
      isNpoAdmin: false,
      isEventCoordinator: false,
      isStaff: false,
      isDonor: false,
      isAuthenticated: true,
      isLoading: false,
      npoId: null,
      user: null,
      hasRole: vi.fn(),
      hasAnyRole: vi.fn(),
      canAccessAdminPWA: true,
      ...overrides,
    }) as ReturnType<typeof useAuth>

  beforeEach(() => {
    vi.clearAllMocks()

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    mockUseAuth.mockReturnValue(buildAuthMock())

    mockUseNpoContext.mockReturnValue({
      selectedNpoId: 'npo-123',
    } as ReturnType<typeof useNpoContext>)

    mockUseEventContext.mockReturnValue({
      selectedEventId: null,
      selectedEventName: null,
      selectedEventSlug: null,
    } as ReturnType<typeof useEventContext>)

    mockUseEventStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useEventStats>)
  })

  it('returns general navigation items based on role', () => {
    const { result } = renderHook(() => useRoleBasedNav(), { wrapper: createWrapper() })

    expect(result.current.navItems).toHaveLength(4)
    expect(result.current.navItems[0]).toMatchObject({ title: 'Dashboard', href: '/' })
    expect(result.current.eventNavItems).toHaveLength(0)
    expect(result.current.eventNavTitle).toBeNull()
  })

  it('adds event navigation group when event is selected', () => {
    mockUseEventContext.mockReturnValue({
      selectedEventId: 'event-123',
      selectedEventName: 'Gala Night',
      selectedEventSlug: 'gala-night',
    } as ReturnType<typeof useEventContext>)

    mockUseEventStats.mockReturnValue({
      data: { name: 'Gala Night' } as any,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useEventStats>)

    const { result } = renderHook(() => useRoleBasedNav(), { wrapper: createWrapper() })

    expect(result.current.eventNavItems).toHaveLength(9)
    expect(result.current.eventNavItems[0]).toMatchObject({
      title: 'Details',
      href: '/events/gala-night/details',
    })
    expect(result.current.eventNavTitle).toBe('Event')
  })

  it('falls back to event ID when slug is unavailable', () => {
    mockUseEventContext.mockReturnValue({
      selectedEventId: 'event-999',
      selectedEventName: 'Spring Gala',
      selectedEventSlug: null,
    } as ReturnType<typeof useEventContext>)

    mockUseEventStats.mockReturnValue({
      data: { name: 'Spring Gala' } as any,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useEventStats>)

    const { result } = renderHook(() => useRoleBasedNav(), { wrapper: createWrapper() })

    expect(result.current.eventNavItems[0]).toMatchObject({
      href: '/events/event-999/details',
    })
    expect(result.current.eventNavTitle).toBe('Event')
  })

  it('returns NPO admin specific navigation and permissions', () => {
    mockUseAuth.mockReturnValue(
      buildAuthMock({
        role: 'npo_admin',
        isSuperAdmin: false,
        isNpoAdmin: true,
      })
    )

    const { result } = renderHook(() => useRoleBasedNav(), { wrapper: createWrapper() })

    const myNpoLink = result.current.navItems.find((item) => item.title === 'My NPO')
    expect(myNpoLink).toMatchObject({ href: '/npos/npo-123' })
    expect(result.current.canModifyNpos).toBe(true)
    expect(result.current.canModifyUsers).toBe(true)
  })

  it('marks staff permissions as read-only for users', () => {
    mockUseAuth.mockReturnValue(
      buildAuthMock({
        role: 'staff',
        isSuperAdmin: false,
        isStaff: true,
      })
    )

    const { result } = renderHook(() => useRoleBasedNav(), { wrapper: createWrapper() })

    const usersNav = result.current.navItems.find((item) => item.title === 'Users')
    expect(usersNav?.badge).toBe('Read-only')
    expect(result.current.canAccessUsers).toBe(false)
    expect(result.current.canModifyUsers).toBe(false)
  })
})
