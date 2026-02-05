/**
 * useEventContext Hook Unit Tests
 *
 * Tests for the React hook integrating EventContext store with React Query.
 * Validates NPO change handling, query invalidation, and event loading.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEventContext } from '../use-event-context'
import { eventApi } from '@/services/event-service'
import * as useNpoContextModule from '../use-npo-context'
import type { Event, EventStatus } from '@/types/event'
import type { ReactNode } from 'react'

// Mock dependencies
vi.mock('../use-npo-context')
vi.mock('@/services/event-service')

describe('useEventContext', () => {
  let queryClient: QueryClient

  const toEventList = (items: Array<Partial<Event>>) => items as Event[]

  const createWrapper = () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return wrapper
  }

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks()

    // Clear localStorage
    localStorage.clear()

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    // Mock useNpoContext to return default NPO
    vi.mocked(useNpoContextModule.useNpoContext).mockReturnValue({
      selectedNpoId: 'npo-123',
      selectedNpoName: 'Test NPO',
      availableNpos: [],
      isLoading: false,
      error: null,
      selectNpo: vi.fn(),
      setAvailableNpos: vi.fn(),
      isFundrboltPlatformView: false,
      isSingleNpoUser: false,
      canChangeNpo: true,
    })

    // Mock eventApi.listEvents to return empty list by default
    vi.mocked(eventApi.listEvents).mockResolvedValue({
      items: toEventList([]),
      total: 0,
      page: 1,
      page_size: 1000,
      total_pages: 1,
    })
  })

  describe('Initial State', () => {
    it('should initialize with null selected event', async () => {
      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.selectedEventId).toBeNull()
        expect(result.current.selectedEventName).toBeNull()
        expect(result.current.selectedEventSlug).toBeNull()
      })
    })

    it('should not fetch events when NPO is not selected', async () => {
      vi.mocked(useNpoContextModule.useNpoContext).mockReturnValue({
        selectedNpoId: null,
        selectedNpoName: 'Fundrbolt Platform',
        availableNpos: [],
        isLoading: false,
        error: null,
        selectNpo: vi.fn(),
        setAvailableNpos: vi.fn(),
        isFundrboltPlatformView: true,
        isSingleNpoUser: false,
        canChangeNpo: true,
      })

      renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(eventApi.listEvents).not.toHaveBeenCalled()
      })
    })
  })

  describe('Event Loading', () => {
    it('should fetch events when NPO is selected', async () => {
      renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(eventApi.listEvents).toHaveBeenCalledWith({
          npo_id: 'npo-123',
          page: 1,
          page_size: 1000,
        })
      })
    })

    it('should set availableEvents from API response', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Test Event 1',
          slug: 'test-event-1',
          status: 'active' as EventStatus,
          event_datetime: '2026-02-01T18:00:00Z',
          logo_url: null,
        },
        {
          id: 'event-2',
          name: 'Test Event 2',
          slug: 'test-event-2',
          status: 'draft' as EventStatus,
          event_datetime: '2026-03-01T18:00:00Z',
          logo_url: 'https://example.com/logo.png',
        },
      ]

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 2,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.availableEvents).toHaveLength(2)
        expect(result.current.availableEvents[0].id).toBe('event-1')
        expect(result.current.availableEvents[1].id).toBe('event-2')
      })
    })

    it('should apply smart default when events load', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Active Event',
          slug: 'active-event',
          status: 'active' as EventStatus,
          event_datetime: '2026-02-01T18:00:00Z',
          logo_url: null,
        },
      ]

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 1,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.selectedEventId).toBe('event-1')
        expect(result.current.selectedEventName).toBe('Active Event')
        expect(result.current.isManualSelection).toBe(false)
      })
    })
  })

  describe('Helper Properties', () => {
    it('should return isEventSelected correctly', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Test Event',
          slug: 'test-event',
          status: 'active' as EventStatus,
          event_datetime: '2026-02-01T18:00:00Z',
          logo_url: null,
        },
      ]

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 1,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isEventSelected).toBe(true)
      })
    })

    it('should return hasMultipleEvents correctly', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event 1',
          slug: 'event-1',
          status: 'active' as EventStatus,
          event_datetime: '2026-02-01T18:00:00Z',
          logo_url: null,
        },
        {
          id: 'event-2',
          name: 'Event 2',
          slug: 'event-2',
          status: 'draft' as EventStatus,
          event_datetime: '2026-03-01T18:00:00Z',
          logo_url: null,
        },
      ]

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 2,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.hasMultipleEvents).toBe(true)
      })
    })

    it('should return shouldShowSearch correctly when 10+ events', async () => {
      const mockEvents = Array.from({ length: 15 }, (_, i) => ({
        id: `event-${i + 1}`,
        name: `Event ${i + 1}`,
        slug: `event-${i + 1}`,
        status: 'active' as EventStatus,
        event_datetime: '2026-02-01T18:00:00Z',
        logo_url: null,
      }))

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 15,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.shouldShowSearch).toBe(true)
      })
    })

    it('should not show search when fewer than 10 events', async () => {
      const mockEvents = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i + 1}`,
        name: `Event ${i + 1}`,
        slug: `event-${i + 1}`,
        status: 'active' as EventStatus,
        event_datetime: '2026-02-01T18:00:00Z',
        logo_url: null,
      }))

      vi.mocked(eventApi.listEvents).mockResolvedValue({
        items: toEventList(mockEvents),
        total: 5,
        page: 1,
        page_size: 1000,
        total_pages: 1,
      })

      const { result } = renderHook(() => useEventContext(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.shouldShowSearch).toBe(false)
      })
    })
  })
})
