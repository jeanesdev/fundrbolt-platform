/**
 * TypeScript types for Auction Gallery (Donor PWA Event Homepage)
 */

import type { AuctionType } from './auction-item';

/**
 * Auction item data for gallery card display
 */
export interface AuctionItemGalleryItem {
  id: string;
  title: string;
  description: string | null;
  auction_type: AuctionType;
  bid_number: number;
  thumbnail_url: string | null;
  starting_bid: number;
  current_bid: number | null;
  bid_count: number;
}

/**
 * Pagination info for gallery response
 */
export interface GalleryPaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_more: boolean;
}

/**
 * Response for auction items gallery endpoint
 */
export interface AuctionItemGalleryResponse {
  items: AuctionItemGalleryItem[];
  pagination: GalleryPaginationInfo;
}

/**
 * Filter type for auction gallery
 */
export type AuctionFilterType = 'all' | 'silent' | 'live';

/**
 * Sort options for auction gallery
 */
export type AuctionSortType = 'newest' | 'highest_bid';
