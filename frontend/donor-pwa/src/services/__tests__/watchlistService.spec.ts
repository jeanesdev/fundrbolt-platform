/**
 * Tests for watchlist service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWatchList, addToWatchList, removeFromWatchList } from '../watchlistService';
import axios from 'axios';

vi.mock('axios');

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

      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const result = await getWatchList('event-id');

      expect(axios.get).toHaveBeenCalledWith(
        '/api/v1/watchlist',
        expect.objectContaining({
          params: { event_id: 'event-id' },
        })
      );
      expect(result).toEqual(mockData);
    });

    it('handles errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

      await expect(getWatchList('event-id')).rejects.toThrow('Network error');
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

      vi.mocked(axios.post).mockResolvedValue({ data: mockResponse });

      const result = await addToWatchList('event-id', 'item-id');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/watchlist',
        { item_id: 'item-id' }
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles errors', async () => {
      vi.mocked(axios.post).mockRejectedValue(new Error('Server error'));

      await expect(addToWatchList('event-id', 'item-id')).rejects.toThrow(
        'Server error'
      );
    });
  });

  describe('removeFromWatchList', () => {
    it('removes item from watch list successfully', async () => {
      vi.mocked(axios.delete).mockResolvedValue({ status: 204 });

      await removeFromWatchList('event-id', 'item-id');

      expect(axios.delete).toHaveBeenCalledWith(
        '/api/v1/watchlist/item-id'
      );
    });

    it('handles errors', async () => {
      vi.mocked(axios.delete).mockRejectedValue(new Error('Server error'));

      await expect(
        removeFromWatchList('event-id', 'item-id')
      ).rejects.toThrow('Server error');
    });
  });
});
