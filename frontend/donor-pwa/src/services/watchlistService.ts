import apiClient from '@/lib/axios';
import type { WatchListEntry, WatchListResponse } from '@/types/watchlist';

/**
 * Watch List Service
 * Handles all watch list-related API calls
 */
class WatchListService {
  /**
   * Get user's watch list for an event
   */
  async getWatchList(_eventId: string): Promise<WatchListResponse> {
    const response = await apiClient.get<{ items: Array<{ id: string }>; total: number }>(
      '/watchlist'
    );

    const watchList = response.data.items
      .filter((item) => !!item.id)
      .map((item) => ({
        id: item.id,
        user_id: '',
        auction_item_id: item.id,
        added_at: '',
      }));

    return {
      watch_list: watchList,
      total: response.data.total,
    };
  }

  /**
   * Add an item to the watch list
   */
  async addToWatchList(_eventId: string, itemId: string): Promise<WatchListEntry> {
    const response = await apiClient.post<{
      id: string;
      user_id: string;
      item_id: string;
      created_at: string;
    }>('/watchlist', {
      item_id: itemId,
    });

    return {
      id: response.data.id,
      user_id: response.data.user_id,
      auction_item_id: response.data.item_id,
      added_at: response.data.created_at,
    };
  }

  /**
   * Remove an item from the watch list
   */
  async removeFromWatchList(_eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/watchlist/${itemId}`);
  }
}

export const watchListService = new WatchListService();
export default watchListService;
