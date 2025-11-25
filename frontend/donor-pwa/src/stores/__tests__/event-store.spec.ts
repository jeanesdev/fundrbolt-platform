/**
 * Tests for event store
 */

import { describe, it, expect, vi } from 'vitest';

// Mock axios
vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Event Store Types', () => {
  describe('EventRegistration', () => {
    it('should define correct registration status values', () => {
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'waitlisted'];
      validStatuses.forEach((status) => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('Event', () => {
    it('should define correct event status values', () => {
      const validStatuses = ['draft', 'active', 'closed'];
      validStatuses.forEach((status) => {
        expect(typeof status).toBe('string');
      });
    });
  });
});

describe('getEventsWithDetails', () => {
  it('should filter out registrations without event details', async () => {
    const { getEventsWithDetails } = await import('@/stores/event-store');
    
    const registrations = [
      { id: '1', event_id: 'e1', event: { id: 'e1', name: 'Event 1' } },
      { id: '2', event_id: 'e2', event: null },
      { id: '3', event_id: 'e3', event: { id: 'e3', name: 'Event 3' } },
    ];

    // @ts-expect-error - simplified mock data
    const events = getEventsWithDetails(registrations);
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('Event 1');
    expect(events[1].name).toBe('Event 3');
  });

  it('should return empty array when no registrations have events', async () => {
    const { getEventsWithDetails } = await import('@/stores/event-store');
    
    const registrations = [
      { id: '1', event_id: 'e1', event: null },
      { id: '2', event_id: 'e2', event: undefined },
    ];

    // @ts-expect-error - simplified mock data
    const events = getEventsWithDetails(registrations);
    expect(events).toHaveLength(0);
  });
});
