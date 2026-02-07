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
  async getWatchList(eventId: string): Promise<WatchListResponse> {
    const response = await apiClient.get<WatchListResponse>(
      `/events/${eventId}/auction-items/watchlist`
    );
    return response.data;
  }

  /**
   * Add an item to the watch list
   */
  async addToWatchList(eventId: string, itemId: string): Promise<WatchListEntry> {
    const response = await apiClient.post<WatchListEntry>(
      `/events/${eventId}/auction-items/${itemId}/watch`
    );
    return response.data;
  }

  /**
   * Remove an item from the watch list
   */
  async removeFromWatchList(eventId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/events/${eventId}/auction-items/${itemId}/watch`);
  }
}

export const watchListService = new WatchListService();
export default watchListService;
