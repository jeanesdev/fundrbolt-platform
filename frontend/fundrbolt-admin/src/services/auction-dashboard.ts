import apiClient from '@/lib/axios'

// --- Types ---

export interface AuctionDashboardSummary {
  total_items: number
  total_bids: number
  total_revenue: number
  average_bid_amount: number
}

export interface AuctionItemRow {
  id: string
  title: string
  auction_type: string
  buy_now_enabled: boolean
  category: string | null
  current_bid_amount: number | null
  bid_count: number
  watcher_count: number
  status: string
  event_id: string
  event_name: string
  donated_by: string | null
}

export interface AuctionItemsListResponse {
  items: AuctionItemRow[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ChartDataPoint {
  label: string
  value: number
  [key: string]: unknown
}

export interface AuctionDashboardCharts {
  revenue_by_type: ChartDataPoint[]
  revenue_by_category: ChartDataPoint[]
  bid_count_by_type: ChartDataPoint[]
  top_items_by_revenue: ChartDataPoint[]
  top_items_by_bid_count: ChartDataPoint[]
  top_items_by_watchers: ChartDataPoint[]
}

export interface BidHistoryEntry {
  id: string
  bidder_number: number
  bidder_name: string
  bid_amount: number
  bid_type: string
  bid_status: string
  placed_at: string
}

export interface BidTimelinePoint {
  timestamp: string
  bid_amount: number
}

export interface AuctionItemFull {
  id: string
  title: string
  description: string | null
  auction_type: string
  category: string | null
  status: string
  starting_bid: number
  current_bid_amount: number | null
  bid_count: number
  watcher_count: number
  buy_now_enabled: boolean
  buy_now_price: number | null
  bid_increment: number
  donated_by: string | null
  donor_value: number | null
  bidding_open: boolean
  event_id: string
  event_name: string
}

export interface AuctionItemDetailResponse {
  item: AuctionItemFull
  bid_history: BidHistoryEntry[]
  bid_timeline: BidTimelinePoint[]
}

// --- Query Params ---

export interface AuctionDashboardParams {
  event_id?: string
  npo_id?: string
  auction_type?: string
  category?: string
}

export interface AuctionItemsParams extends AuctionDashboardParams {
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

// --- Service ---

class AuctionDashboardService {
  async getSummary(params: AuctionDashboardParams = {}) {
    const response = await apiClient.get<AuctionDashboardSummary>(
      '/admin/auction-dashboard/summary',
      { params },
    )
    return response.data
  }

  async getItems(params: AuctionItemsParams = {}) {
    const response = await apiClient.get<AuctionItemsListResponse>(
      '/admin/auction-dashboard/items',
      { params },
    )
    return response.data
  }

  async getCharts(params: AuctionDashboardParams = {}) {
    const response = await apiClient.get<AuctionDashboardCharts>(
      '/admin/auction-dashboard/charts',
      { params },
    )
    return response.data
  }

  async getItemDetail(itemId: string) {
    const response = await apiClient.get<AuctionItemDetailResponse>(
      `/admin/auction-dashboard/items/${itemId}`,
    )
    return response.data
  }

  getExportUrl(params: AuctionItemsParams = {}): string {
    const searchParams = new URLSearchParams()
    if (params.event_id) searchParams.set('event_id', params.event_id)
    if (params.npo_id) searchParams.set('npo_id', params.npo_id)
    if (params.auction_type) searchParams.set('auction_type', params.auction_type)
    if (params.category) searchParams.set('category', params.category)
    if (params.search) searchParams.set('search', params.search)
    if (params.sort_by) searchParams.set('sort_by', params.sort_by)
    if (params.sort_order) searchParams.set('sort_order', params.sort_order)
    const qs = searchParams.toString()
    return `/admin/auction-dashboard/items/export${qs ? `?${qs}` : ''}`
  }
}

export const auctionDashboardService = new AuctionDashboardService()
