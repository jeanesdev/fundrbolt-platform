/**
 * Watch List TypeScript types
 */

export interface WatchListEntry {
  id: string;
  user_id: string;
  auction_item_id: string;
  added_at: string;
}

export interface WatchListResponse {
  watch_list: WatchListEntry[];
  total: number;
}
