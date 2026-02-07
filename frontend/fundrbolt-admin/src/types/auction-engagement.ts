/**
 * Auction Item Engagement and Promotion TypeScript types
 */

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface WatcherSummary {
  user: UserSummary;
  watching_since: string;
}

export interface ItemViewSummary {
  user: UserSummary;
  total_duration_seconds: number;
  last_viewed_at: string;
}

export interface BidSummary {
  id: string;
  user: UserSummary;
  amount: number;
  bid_type: 'regular' | 'max_bid';
  placed_at: string;
}

export interface AdminEngagementResponse {
  auction_item_id: string;
  watchers: WatcherSummary[];
  views: ItemViewSummary[];
  bids: BidSummary[];
  summary: {
    total_watchers: number;
    total_views: number;
    unique_viewers: number;
    total_view_duration_seconds: number;
    total_bids: number;
  };
}

export interface ItemPromotionUpdate {
  promotion_badge?: string | null;
  promotion_notice?: string | null;
}

export interface BuyNowAvailabilityUpdate {
  buy_now_enabled: boolean;
  quantity_available?: number;
  override_reason?: string | null;
}
