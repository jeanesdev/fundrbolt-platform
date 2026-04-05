import apiClient from '@/lib/axios'

// Commission types
export interface CommissionUpsertRequest {
  commission_percent: number
  flat_fee: number
  notes?: string
}

export interface CommissionResponse {
  id: string
  auctioneer_user_id: string
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
  cost: number | null
  primary_image_url: string | null
  created_at: string
  updated_at: string
}

export interface CommissionListResponse {
  commissions: CommissionListItem[]
  total: number
}

// Event settings types
export interface EventSettingsUpsertRequest {
  live_auction_percent: number
  paddle_raise_percent: number
  silent_auction_percent: number
}

export interface EventSettingsResponse {
  id: string
  auctioneer_user_id: string
  event_id: string
  live_auction_percent: number
  paddle_raise_percent: number
  silent_auction_percent: number
  created_at: string
  updated_at: string
}

// Dashboard types
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

// Live auction types
export interface HighBidder {
  bidder_number: number | null
  full_name: string
  table_number: number | null
  profile_picture_url: string | null
}

export interface BidHistoryEntry {
  bidder_number: number | null
  bidder_name: string
  amount: number
  placed_at: string
}

export interface LiveAuctionItem {
  id: string
  title: string
  description: string | null
  image_url: string | null
  starting_bid: number | null
  current_bid: number | null
  bid_count: number
}

export interface LiveAuctionResponse {
  current_item: LiveAuctionItem | null
  high_bidder: HighBidder | null
  bid_history: BidHistoryEntry[]
}

class AuctioneerService {
  // Commission CRUD
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

  // Event settings
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

  // Dashboard
  async getDashboard(eventId: string): Promise<DashboardResponse> {
    const response = await apiClient.get<DashboardResponse>(
      `/admin/events/${eventId}/auctioneer/dashboard`
    )
    return response.data
  }

  // Live auction
  async getLiveAuction(eventId: string): Promise<LiveAuctionResponse> {
    const response = await apiClient.get<LiveAuctionResponse>(
      `/admin/events/${eventId}/auctioneer/live-auction`
    )
    return response.data
  }
}

export const auctioneerService = new AuctioneerService()
export default auctioneerService
