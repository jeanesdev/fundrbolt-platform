/**
 * Tests for useItemViewTracking hook
 */

import auctionItemService from '@/services/auctionItemService';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useItemViewTracking } from '../useItemViewTracking';

const auctionItemMocks = vi.hoisted(() => ({
  trackItemView: vi.fn(),
}));

// Mock the auction item service
vi.mock('@/services/auctionItemService', () => ({
  __esModule: true,
  default: {
    trackItemView: auctionItemMocks.trackItemView,
  },
}));

describe('useItemViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    auctionItemMocks.trackItemView.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks view when item is opened', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking({ eventId: 'event-1', itemId: 'test-item-id', enabled: true })
    );

    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);

    // Unmount to trigger cleanup
    unmount();

    expect(auctionItemService.trackItemView).toHaveBeenCalledWith(
      'event-1',
      'test-item-id',
      expect.any(Number)
    );
  });

  it('does not track view for duration less than 1 second', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking({ eventId: 'event-1', itemId: 'test-item-id', enabled: true })
    );

    // Advance timer by less than 1 second
    vi.advanceTimersByTime(500);

    unmount();

    expect(auctionItemService.trackItemView).not.toHaveBeenCalled();
  });

  it('does not track view when not open', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking({ eventId: 'event-1', itemId: 'test-item-id', enabled: false })
    );

    vi.advanceTimersByTime(5000);
    unmount();

    expect(auctionItemService.trackItemView).not.toHaveBeenCalled();
  });

  it('tracks correct duration', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking({ eventId: 'event-1', itemId: 'test-item-id', enabled: true })
    );

    // Advance timer by 10 seconds
    vi.advanceTimersByTime(10000);

    unmount();

    expect(auctionItemService.trackItemView).toHaveBeenCalledWith(
      'event-1',
      'test-item-id',
      expect.any(Number)
    );

    // Check that duration is approximately 10 seconds (allow for small variance)
    const callArgs = vi.mocked(auctionItemService.trackItemView).mock.calls[0];
    expect(callArgs[2]).toBeGreaterThanOrEqual(9);
    expect(callArgs[2]).toBeLessThanOrEqual(11);
  });

  it('resets tracking when item changes', () => {
    const { rerender, unmount } = renderHook(
      ({ itemId }) => useItemViewTracking({ eventId: 'event-1', itemId, enabled: true }),
      { initialProps: { itemId: 'item-1' } }
    );

    vi.advanceTimersByTime(5000);

    // Change item
    rerender({ itemId: 'item-2' });

    vi.advanceTimersByTime(3000);

    unmount();

    // Should have tracked both items
    expect(auctionItemService.trackItemView).toHaveBeenCalledTimes(2);
  });
});
