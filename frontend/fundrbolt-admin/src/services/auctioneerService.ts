import { type SlidePresentationLayout } from '@/types/auction-item'
import apiClient from '@/lib/axios'

export interface CommissionUpsertRequest {
  commission_percent: number
  flat_fee: number
  notes?: string
}

export interface CommissionResponse {
  id: string
  auction_item_id: string
  commission_percent: number
  flat_fee: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CommissionListItem {
  id: string
  auction_item_id: string
  auction_item_title: string
  auction_item_bid_number: number | null
  auction_type: string | null
  commission_percent: number
  flat_fee: number
  notes: string | null
  item_status: string | null
  current_bid_amount: number | null
  quantity_available: number | null
  bid_count: number
  donor_value: number | null
  cost: number | null
  primary_image_url: string | null
  created_at: string
  updated_at: string
}

export interface CommissionListResponse {
  commissions: CommissionListItem[]
  total: number
}

export interface EventSettingsUpsertRequest {
  live_auction_percent: number
  paddle_raise_percent: number
  silent_auction_percent: number
  paddle_raise_levels: number[]
  paddle_raise_total_goal: number | null
  paddle_raise_level_goals: Record<string, number>
  paddle_raise_level_notes: Record<string, string>
}

export interface EventSettingsResponse {
  auctioneer_user_id: string
  event_id: string
  live_auction_percent: number
  paddle_raise_percent: number
  silent_auction_percent: number
  paddle_raise_levels: number[]
  paddle_raise_total_goal: number | null
  paddle_raise_level_goals: Record<string, number>
  paddle_raise_level_notes: Record<string, string>
  created_at: string
  updated_at: string
}

export interface EarningsSummary {
  per_item_total: number
  per_item_count: number
  live_auction_category_earning: number
  paddle_raise_category_earning: number
  silent_auction_category_earning: number
  total_earnings: number
}

export interface EventTotals {
  live_auction_raised: number
  paddle_raise_raised: number
  silent_auction_raised: number
  event_total_raised: number
}

export interface TimerData {
  live_auction_start_datetime: string | null
  auction_close_datetime: string | null
  live_auction_status: 'not_started' | 'in_progress' | 'ended' | 'not_scheduled'
  silent_auction_status: 'not_started' | 'open' | 'closed' | 'not_scheduled'
}

export interface DashboardResponse {
  earnings: EarningsSummary
  event_totals: EventTotals
  timers: TimerData
  last_refreshed_at: string
}

export interface HighBidder {
  bidder_number: number | null
  first_name: string
  last_name: string
  table_number: number | null
  profile_picture_url: string | null
}

export interface BidHistoryEntry {
  bidder_number: number | null
  bidder_name: string
  bid_amount: number
  placed_at: string
}

export interface LiveAuctionItem {
  id: string
  bid_number: number | null
  title: string
  description: string | null
  starting_bid: number | null
  current_bid_amount: number | null
  bid_count: number
  primary_image_url: string | null
  donor_value: number | null
  cost: number | null
}

export interface LiveAuctionResponse {
  current_item: LiveAuctionItem | null
  high_bidder: HighBidder | null
  bid_history: BidHistoryEntry[]
  auction_status: 'not_started' | 'in_progress' | 'ended' | 'not_scheduled'
}

export interface AuctioneerItemSummary {
  id: string
  bid_number: number | null
  title: string
  auction_type: string
  status: string | null
  description: string | null
  current_bid_amount: number | null
  bid_count: number
  bidder_count: number
  primary_image_url: string | null
  donor_value: number | null
  cost: number | null
  commission_percent: number | null
  flat_fee: number | null
  has_commission: boolean
  has_bounty: boolean
  slide_presentation_html: string | null
  slide_presentation_layout: SlidePresentationLayout
}

export interface AuctioneerItemGalleryResponse {
  items: AuctioneerItemSummary[]
  total_items: number
  total_raised: number
  total_bids: number
}

export interface AuctioneerBidderProfile {
  bidder_number: number | null
  bidder_name: string
  table_number: number | null
  profile_picture_url: string | null
  user_id: string | null
}

export interface AuctioneerBidActivityEntry {
  id: string
  bid_amount: number
  placed_at: string
  bid_status: string
  bid_source: 'live' | 'silent' | 'paddle_raise'
  label_names: string[]
  is_monthly: boolean
  bidder: AuctioneerBidderProfile
}

export interface AuctioneerBidderSummary {
  bidder: AuctioneerBidderProfile
  total_bid_amount: number
  highest_bid_amount: number
  bid_count: number
  latest_bid_at: string
}

export interface AuctioneerItemDetailResponse {
  item: AuctioneerItemSummary
  current_high_bid: number | null
  high_bidder: AuctioneerBidderProfile | null
  bids: AuctioneerBidActivityEntry[]
  bidder_summaries: AuctioneerBidderSummary[]
}

export interface AuctioneerPaddleRaiseLevelSummary {
  amount: number
  bidder_count: number
  total_amount: number
  participation_percent: number
  donations_count: number
  goal_amount: number | null
  goal_progress_percent: number | null
  is_monthly: boolean
}

export interface AuctioneerPaddleRaiseBidderSummary {
  bidder: AuctioneerBidderProfile
  total_amount: number
  donation_count: number
  label_names: string[]
  is_last_hero: boolean
}

export interface AuctioneerPaddleRaiseResponse {
  configured_levels: number[]
  total_pledged: number
  total_goal: number | null
  total_goal_progress_percent: number | null
  donation_count: number
  unique_donor_count: number
  participation_percent: number
  last_hero_total: number
  level_summaries: AuctioneerPaddleRaiseLevelSummary[]
  donations: AuctioneerBidActivityEntry[]
  bidder_totals: AuctioneerPaddleRaiseBidderSummary[]
  last_hero_bidder_totals: AuctioneerPaddleRaiseBidderSummary[]
}

class AuctioneerService {
  async getCommissions(eventId: string): Promise<CommissionListResponse> {
    const response = await apiClient.get<CommissionListResponse>(
      `/admin/events/${eventId}/auctioneer/commissions`
    )
    return response.data
  }

  async upsertCommission(
    eventId: string,
    auctionItemId: string,
    data: CommissionUpsertRequest
  ): Promise<CommissionResponse> {
    const response = await apiClient.put<CommissionResponse>(
      `/admin/events/${eventId}/auctioneer/commissions/${auctionItemId}`,
      data
    )
    return response.data
  }

  async deleteCommission(
    eventId: string,
    auctionItemId: string
  ): Promise<void> {
    await apiClient.delete(
      `/admin/events/${eventId}/auctioneer/commissions/${auctionItemId}`
    )
  }

  async getSettings(eventId: string): Promise<EventSettingsResponse | null> {
    try {
      const response = await apiClient.get<EventSettingsResponse>(
        `/admin/events/${eventId}/auctioneer/settings`
      )
      return response.data
    } catch {
      return null
    }
  }

  async upsertSettings(
    eventId: string,
    data: EventSettingsUpsertRequest
  ): Promise<EventSettingsResponse> {
    const response = await apiClient.put<EventSettingsResponse>(
      `/admin/events/${eventId}/auctioneer/settings`,
      data
    )
    return response.data
  }

  async getDashboard(eventId: string): Promise<DashboardResponse> {
    const response = await apiClient.get<DashboardResponse>(
      `/admin/events/${eventId}/auctioneer/dashboard`
    )
    return response.data
  }

  async getLiveAuction(eventId: string): Promise<LiveAuctionResponse> {
    const response = await apiClient.get<LiveAuctionResponse>(
      `/admin/events/${eventId}/auctioneer/live-auction`
    )
    return response.data
  }

  async getLiveAuctionGallery(
    eventId: string
  ): Promise<AuctioneerItemGalleryResponse> {
    const response = await apiClient.get<AuctioneerItemGalleryResponse>(
      `/admin/events/${eventId}/auctioneer/live-auction/gallery`
    )
    return response.data
  }

  async getSilentAuctionGallery(
    eventId: string
  ): Promise<AuctioneerItemGalleryResponse> {
    const response = await apiClient.get<AuctioneerItemGalleryResponse>(
      `/admin/events/${eventId}/auctioneer/silent-auction/gallery`
    )
    return response.data
  }

  async getAuctioneerItemDetail(
    eventId: string,
    itemId: string
  ): Promise<AuctioneerItemDetailResponse> {
    const response = await apiClient.get<AuctioneerItemDetailResponse>(
      `/admin/events/${eventId}/auctioneer/items/${itemId}`
    )
    return response.data
  }

  async getPaddleRaise(
    eventId: string
  ): Promise<AuctioneerPaddleRaiseResponse> {
    const response = await apiClient.get<AuctioneerPaddleRaiseResponse>(
      `/admin/events/${eventId}/auctioneer/paddle-raise`
    )
    return response.data
  }

  async downloadLiveAuctionSlides(eventId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/live-auction/slides/export`,
      {
        responseType: 'blob',
      }
    )
    return response.data
  }

  async downloadSilentAuctionSlides(eventId: string): Promise<Blob> {
    const response = await apiClient.get<Blob>(
      `/admin/events/${eventId}/auctioneer/silent-auction/slides/export`,
      {
        responseType: 'blob',
      }
    )
    return response.data
  }
}

export const auctioneerService = new AuctioneerService()
export default auctioneerService
