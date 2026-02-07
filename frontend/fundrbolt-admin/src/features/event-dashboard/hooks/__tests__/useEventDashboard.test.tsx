/**
 * Tests for useEventDashboard hook
 * Focus: React Query integration and auto-refresh behavior
 */

import { useEventDashboard } from '@/features/event-dashboard/hooks/useEventDashboard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import type { ReactNode } from 'react'

// Mock the API client
vi.mock('@/services/event-dashboard', () => ({
  getDashboardSummary: vi.fn(),
}))

import { getDashboardSummary } from '@/services/event-dashboard'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useEventDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches dashboard data on mount', async () => {
    const mockData = {
      event_id: 'test-event-id',
      goal: { amount: '100000.00', currency: 'USD' },
      total_actual: { amount: '75000.00', currency: 'USD' },
      total_projected: { amount: '95000.00', currency: 'USD' },
      variance_amount: { amount: '25000.00', currency: 'USD' },
      variance_percent: 25.0,
      pacing: {
        status: 'on_track' as const,
        pacing_percent: 85.0,
        trajectory: 'linear' as const,
      },
      sources: [],
      waterfall: [],
      cashflow: [],
      funnel: [],
      alerts: [],
      last_refreshed_at: new Date().toISOString(),
    }

    ;(getDashboardSummary as Mock).mockResolvedValue(mockData)

    const { result } = renderHook(
      () =>
        useEventDashboard({
          eventId: 'test-event-id',
          scenario: 'base',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(getDashboardSummary).toHaveBeenCalledWith({
      eventId: 'test-event-id',
      scenario: 'base',
    })
    expect(result.current.data).toEqual(mockData)
  })

  it('handles loading state correctly', () => {
    ;(getDashboardSummary as Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { result } = renderHook(
      () =>
        useEventDashboard({
          eventId: 'test-event-id',
        }),
      { wrapper: createWrapper() }
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('handles error state correctly', async () => {
    const error = new Error('Failed to fetch dashboard')
    ;(getDashboardSummary as Mock).mockRejectedValue(error)

    const { result } = renderHook(
      () =>
        useEventDashboard({
          eventId: 'test-event-id',
        }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('can be disabled via enabled parameter', () => {
    const { result } = renderHook(
      () =>
        useEventDashboard(
          {
            eventId: 'test-event-id',
          },
          false // enabled = false
        ),
      { wrapper: createWrapper() }
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(getDashboardSummary).not.toHaveBeenCalled()
  })
})
