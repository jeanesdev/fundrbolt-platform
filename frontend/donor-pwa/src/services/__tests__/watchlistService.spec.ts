/**
 * Tests for watchlist service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import watchListService from '../watchlistService';

const apiClientMocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: apiClientMocks.apiGet,
    post: apiClientMocks.apiPost,
    delete: apiClientMocks.apiDelete,
  },
}));

describe('watchlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWatchList', () => {
    it('fetches watch list successfully', async () => {
      const mockData = {
        items: [
          { id: 'item-1', title: 'Item 1' },
          { id: 'item-2', title: 'Item 2' },
        ],
        total: 2,
      };

      apiClientMocks.apiGet.mockResolvedValue({ data: mockData });

      const result = await watchListService.getWatchList('event-id');

      expect(apiClientMocks.apiGet).toHaveBeenCalledWith(
        '/events/event-id/auction-items/watchlist'
      );
      expect(result).toEqual(mockData);
    });

    it('handles errors', async () => {
      apiClientMocks.apiGet.mockRejectedValue(new Error('Network error'));

      await expect(watchListService.getWatchList('event-id')).rejects.toThrow('Network error');
    });
  });

  describe('addToWatchList', () => {
    it('adds item to watch list successfully', async () => {
      const mockResponse = {
        id: 'entry-id',
        item_id: 'item-id',
        user_id: 'user-id',
        event_id: 'event-id',
      };

      apiClientMocks.apiPost.mockResolvedValue({ data: mockResponse });

      const result = await watchListService.addToWatchList('event-id', 'item-id');

      expect(apiClientMocks.apiPost).toHaveBeenCalledWith(
        '/events/event-id/auction-items/item-id/watch'
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      apiClientMocks.apiPost.mockRejectedValue(new Error('Server error'));

      await expect(watchListService.addToWatchList('event-id', 'item-id')).rejects.toThrow(
        'Server error'
      );
    });
  });

  describe('removeFromWatchList', () => {
    it('removes item from watch list successfully', async () => {
      apiClientMocks.apiDelete.mockResolvedValue({ status: 204 });

      await watchListService.removeFromWatchList('event-id', 'item-id');

      expect(apiClientMocks.apiDelete).toHaveBeenCalledWith(
        '/events/event-id/auction-items/item-id/watch'
      );
    });

    it('handles errors', async () => {
      apiClientMocks.apiDelete.mockRejectedValue(new Error('Server error'));

      await expect(
        watchListService.removeFromWatchList('event-id', 'item-id')
      ).rejects.toThrow('Server error');
    });
  });
});
