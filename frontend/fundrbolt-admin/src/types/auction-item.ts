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

export enum SlidePresentationLayout {
  ON_IMAGE = 'on_image',
  LEFT_OF_IMAGE = 'left_of_image',
  RIGHT_OF_IMAGE = 'right_of_image',
  BELOW_IMAGE = 'below_image',
}

export interface AuctionItemBase {
  title: string
  description: string
  auction_type: AuctionType
  category?: string | null
  starting_bid: number
  bid_increment: number
  donor_value?: number | null
  cost?: number | null
  buy_now_price?: number | null
  buy_now_enabled: boolean
  quantity_available: number
  donated_by?: string | null
  sponsor_id?: string | null
  item_webpage?: string | null
  display_priority?: number | null
  slide_presentation_html?: string | null
  slide_presentation_layout: SlidePresentationLayout
  display_starting_bid: boolean
  display_fair_market_value: boolean
}

export interface AuctionItem extends AuctionItemBase {
  id: string
  event_id: string
  bid_number: number
  status: ItemStatus
  created_by: string
  created_at: string
  updated_at: string
  primary_image_url?: string | null
  current_bid_amount?: number | null
  bid_count?: number
  original_close_at?: string | null
  effective_close_at?: string | null
}

export interface AuctionItemDetail extends AuctionItem {
  media: AuctionItemMedia[] // Media items with SAS URLs for secure access
  // Sponsor will be added when we integrate sponsor display
}

export interface AuctionItemCreate extends Omit<
  AuctionItemBase,
  'starting_bid' | 'bid_increment'
> {
  starting_bid?: number
  bid_increment?: number
}

export interface AuctionItemUpdate {
  title?: string
  description?: string
  auction_type?: AuctionType
  category?: string | null
  starting_bid?: number
  bid_increment?: number
  donor_value?: number | null
  cost?: number | null
  buy_now_price?: number | null
  buy_now_enabled?: boolean
  quantity_available?: number
  donated_by?: string | null
  sponsor_id?: string | null
  item_webpage?: string | null
  display_priority?: number | null
  slide_presentation_html?: string | null
  slide_presentation_layout?: SlidePresentationLayout
  display_starting_bid?: boolean
  display_fair_market_value?: boolean
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

export interface AuctionItemListResponse {
  items: AuctionItem[]
  pagination: PaginationInfo
}

export interface SilentAuctionExtensionPolicy {
  id: string
  event_id: string
  auto_extension_enabled: boolean
  trigger_window_minutes: number
  extension_duration_minutes: number
  max_total_extension_minutes: number
  updated_by_user_id?: string | null
  created_at: string
  updated_at: string
}

export interface SilentAuctionExtensionPolicyUpdate {
  auto_extension_enabled: boolean
  extension_duration_minutes: number
  max_total_extension_minutes: number
}

// Media Management Types

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export interface AuctionItemMedia {
  id: string
  auction_item_id: string
  media_type: MediaType
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  display_order: number
  thumbnail_path: string | null
  video_url: string | null
  created_at: string
  updated_at: string
}

export interface MediaUploadRequest {
  file_name: string
  content_type: string
  file_size: number
  media_type: 'image' | 'video'
}

export interface MediaUploadResponse {
  upload_url: string
  media_url: string
  blob_name: string
  expires_in: number
}

export interface MediaUploadConfirmRequest {
  blob_name: string
  file_name: string
  file_size: number
  content_type: string
  media_type: 'image' | 'video'
  video_url?: string | null
}

export interface MediaListResponse {
  items: AuctionItemMedia[]
  total: number
}

export interface MediaReorderRequest {
  media_order: string[]
}
