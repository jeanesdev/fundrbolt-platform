/**
 * Auction Item TypeScript types for frontend application
 */

export enum AuctionType {
  LIVE = 'live',
  SILENT = 'silent',
}

export enum ItemStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  SOLD = 'sold',
  WITHDRAWN = 'withdrawn',
}

export interface AuctionItemBase {
  title: string;
  description: string;
  auction_type: AuctionType;
  starting_bid: number;
  bid_increment: number;
  donor_value?: number | null;
  cost?: number | null;
  buy_now_price?: number | null;
  buy_now_enabled: boolean;
  quantity_available: number;
  donated_by?: string | null;
  sponsor_id?: string | null;
  item_webpage?: string | null;
  display_priority?: number | null;
}

export interface AuctionItem extends AuctionItemBase {
  id: string;
  event_id: string;
  bid_number: number;
  status: ItemStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  primary_image_url?: string | null; // Primary image thumbnail URL (with SAS token if Azure)
  current_bid_amount?: number | null;
  min_next_bid_amount?: number | null;
  bid_count?: number;
  bidding_open?: boolean;
  watcher_count?: number;
  promotion_badge?: string | null;
  promotion_notice?: string | null;
}

export interface AuctionItemDetail extends AuctionItem {
  media: AuctionItemMedia[]; // Media items with SAS URLs for secure access
  // Sponsor will be added when we integrate sponsor display
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AuctionItemCreate extends AuctionItemBase { }

export interface AuctionItemUpdate {
  title?: string;
  description?: string;
  auction_type?: AuctionType;
  starting_bid?: number;
  bid_increment?: number;
  donor_value?: number | null;
  cost?: number | null;
  buy_now_price?: number | null;
  buy_now_enabled?: boolean;
  quantity_available?: number;
  donated_by?: string | null;
  sponsor_id?: string | null;
  item_webpage?: string | null;
  display_priority?: number | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AuctionItemListResponse {
  items: AuctionItem[];
  pagination: PaginationInfo;
}

// Media Management Types

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export interface AuctionItemMedia {
  id: string;
  auction_item_id: string;
  media_type: MediaType;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  display_order: number;
  thumbnail_path: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaUploadRequest {
  file_name: string;
  content_type: string;
  file_size: number;
  media_type: 'image' | 'video';
}

export interface MediaUploadResponse {
  upload_url: string;
  media_url: string;
  blob_name: string;
  expires_in: number;
}

export interface MediaUploadConfirmRequest {
  blob_name: string;
  file_name: string;
  file_size: number;
  content_type: string;
  media_type: 'image' | 'video';
  video_url?: string | null;
}

export interface MediaListResponse {
  items: AuctionItemMedia[];
  total: number;
}

export interface MediaReorderRequest {
  media_order: string[];
}

// Bidding Types

export interface BidRequest {
  amount: number;
}

export interface MaxBidRequest {
  max_amount: number;
}

export interface BidResponse {
  id: string;
  auction_item_id: string;
  bidder_id: string;
  amount: number;
  is_max_bid: boolean;
  bid_time: string;
  is_winning: boolean;
  outbid_notification_sent: boolean;
}
