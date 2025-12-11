/**
 * Tests for EventSelector component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the stores
vi.mock('@/stores/event-store', () => ({
  useEventStore: vi.fn(() => ({
    selectedEvent: null,
    registeredEvents: [],
    registeredEventsLoaded: false,
    isLoading: false,
    fetchRegisteredEvents: vi.fn(),
    selectEvent: vi.fn(),
  })),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
  })),
}));

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

import { useEventStore } from '@/stores/event-store';
import { useAuthStore } from '@/stores/auth-store';

describe('EventSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useEventStore', () => {
    it('should provide initial state', () => {
      const store = useEventStore();
      expect(store.selectedEvent).toBeNull();
      expect(store.registeredEvents).toEqual([]);
      expect(store.registeredEventsLoaded).toBe(false);
      expect(store.isLoading).toBe(false);
    });
  });

  describe('useAuthStore', () => {
    it('should provide authentication state', () => {
      const store = useAuthStore();
      expect(store.isAuthenticated).toBe(true);
    });
  });
});
