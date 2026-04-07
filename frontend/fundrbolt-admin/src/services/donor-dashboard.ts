import apiClient from '@/lib/axios'

// --- Types ---

export interface DonorLeaderboardEntry {
  user_id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  total_given: number
  events_attended: number
  ticket_total: number
  donation_total: number
  silent_auction_total: number
  live_auction_total: number
  buy_now_total: number
}

export interface DonorLeaderboardResponse {
  items: DonorLeaderboardEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface EventAttendance {
  event_id: string
  event_name: string
  event_date: string
  npo_id: string
  npo_name: string
  checked_in: boolean
  total_given_at_event: number
}

export interface BidRecord {
  bid_id: string
  event_id: string
  event_name: string
  npo_id?: string
  npo_name?: string
  item_id: string
  item_title: string
  item_category: string | null
  bid_amount: number
  bid_status: string
  bid_type: string
  created_at: string
}

export interface DonationRecord {
  donation_id: string
  event_id: string
  event_name: string
  npo_id?: string
  npo_name?: string
  amount: number
  source: string
  is_paddle_raise: boolean
  created_at: string
}

export interface TicketRecord {
  purchase_id: string
  event_id: string
  event_name: string
  npo_id?: string
  npo_name?: string
  package_name: string
  quantity: number
  total_price: number
  purchased_at: string
}

export interface OutbidSummary {
  total_outbid_amount: number
  items_bid_on: number
  items_won: number
  items_lost: number
  win_rate: number
}

export interface CategoryInterest {
  category: string
  bid_count: number
  total_bid_amount: number
  items_won: number
}

export interface DonorProfileResponse {
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  is_active: boolean
  total_given: number
  events_attended: number
  event_history: EventAttendance[]
  bid_history: BidRecord[]
  donation_history: DonationRecord[]
  ticket_history: TicketRecord[]
  category_interests: CategoryInterest[]
  outbid_summary: OutbidSummary
}

export interface OutbidLeaderEntry {
  user_id: string
  first_name: string
  last_name: string
  total_outbid_amount: number
  items_bid_on: number
  items_won: number
  items_lost: number
  win_rate: number
}

export interface OutbidLeadersResponse {
  items: OutbidLeaderEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface BidWarItem {
  item_id: string
  item_title: string
  bid_count: number
  highest_bid: number
  won: boolean
}

export interface BidWarEntry {
  user_id: string
  first_name: string
  last_name: string
  bid_war_count: number
  total_bids_in_wars: number
  top_war_items: BidWarItem[]
}

export interface BidWarsResponse {
  items: BidWarEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface GivingTypeEntry {
  category: string
  total_amount: number
  donor_count: number
}

export interface AuctionCategoryEntry {
  category: string
  total_bid_amount: number
  total_revenue: number
  bid_count: number
  item_count: number
}

export interface CategoryBreakdownResponse {
  giving_type_breakdown: GivingTypeEntry[]
  auction_category_breakdown: AuctionCategoryEntry[]
}

// --- Query Params ---

export interface LeaderboardParams {
  event_id?: string
  npo_id?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  search?: string
  page?: number
  per_page?: number
}

export interface ScopedParams {
  event_id?: string
  npo_id?: string
}

export interface PaginatedScopedParams extends ScopedParams {
  page?: number
  per_page?: number
}

// --- Service ---

class DonorDashboardService {
  async getLeaderboard(params: LeaderboardParams = {}) {
    const response = await apiClient.get<DonorLeaderboardResponse>(
      '/admin/donor-dashboard/leaderboard',
      { params }
    )
    return response.data
  }

  async getDonorProfile(userId: string, params: ScopedParams = {}) {
    const response = await apiClient.get<DonorProfileResponse>(
      `/admin/donor-dashboard/donors/${userId}`,
      { params }
    )
    return response.data
  }

  async getOutbidLeaders(params: PaginatedScopedParams = {}) {
    const response = await apiClient.get<OutbidLeadersResponse>(
      '/admin/donor-dashboard/outbid-leaders',
      { params }
    )
    return response.data
  }

  async getBidWars(params: PaginatedScopedParams = {}) {
    const response = await apiClient.get<BidWarsResponse>(
      '/admin/donor-dashboard/bid-wars',
      { params }
    )
    return response.data
  }

  async getCategoryBreakdown(params: ScopedParams = {}) {
    const response = await apiClient.get<CategoryBreakdownResponse>(
      '/admin/donor-dashboard/category-breakdown',
      { params }
    )
    return response.data
  }

  getExportUrl(params: LeaderboardParams = {}): string {
    const searchParams = new URLSearchParams()
    if (params.event_id) searchParams.set('event_id', params.event_id)
    if (params.npo_id) searchParams.set('npo_id', params.npo_id)
    if (params.sort_by) searchParams.set('sort_by', params.sort_by)
    if (params.sort_order) searchParams.set('sort_order', params.sort_order)
    if (params.search) searchParams.set('search', params.search)
    const qs = searchParams.toString()
    return `/admin/donor-dashboard/leaderboard/export${qs ? `?${qs}` : ''}`
  }
}

export const donorDashboardService = new DonorDashboardService()
