/**
 * Tests for useItemViewTracking hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useItemViewTracking } from '../useItemViewTracking';
import * as auctionItemService from '@/services/auctionItemService';

// Mock the auction item service
vi.mock('@/services/auctionItemService', () => ({
  trackItemView: vi.fn(),
}));

describe('useItemViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks view when item is opened', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking('test-item-id', true)
    );

    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000);

    // Unmount to trigger cleanup
    unmount();

    expect(auctionItemService.trackItemView).toHaveBeenCalledWith(
      'test-item-id',
      expect.any(Number)
    );
  });

  it('does not track view for duration less than 1 second', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking('test-item-id', true)
    );

    // Advance timer by less than 1 second
    vi.advanceTimersByTime(500);

    unmount();

    expect(auctionItemService.trackItemView).not.toHaveBeenCalled();
  });

  it('does not track view when not open', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking('test-item-id', false)
    );

    vi.advanceTimersByTime(5000);
    unmount();

    expect(auctionItemService.trackItemView).not.toHaveBeenCalled();
  });

  it('tracks correct duration', () => {
    const { unmount } = renderHook(() =>
      useItemViewTracking('test-item-id', true)
    );

    // Advance timer by 10 seconds
    vi.advanceTimersByTime(10000);

    unmount();

    expect(auctionItemService.trackItemView).toHaveBeenCalledWith(
      'test-item-id',
      expect.any(Number)
    );

    // Check that duration is approximately 10 seconds (allow for small variance)
    const callArgs = vi.mocked(auctionItemService.trackItemView).mock.calls[0];
    expect(callArgs[1]).toBeGreaterThanOrEqual(9);
    expect(callArgs[1]).toBeLessThanOrEqual(11);
  });

  it('resets tracking when item changes', () => {
    const { rerender, unmount } = renderHook(
      ({ itemId }) => useItemViewTracking(itemId, true),
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
