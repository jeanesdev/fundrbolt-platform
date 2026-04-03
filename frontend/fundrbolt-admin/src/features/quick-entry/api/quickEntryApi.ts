import apiClient from '@/lib/axios'
import type { AuctionItem } from '@/types/auction-item'

export async function getQuickEntryStatus(
  eventId: string
): Promise<{ status: string }> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/quick-entry/status`
  )
  return response.data
}

export interface CreateLiveBidPayload {
  item_id: string
  amount: number
  bidder_number: number
}

export interface LiveBidResponse {
  id: string
  event_id: string
  item_id: string
  amount: number
  bidder_number: number
  donor_name: string | null
  table_number: string | null
  accepted_at: string
}

export interface QuickEntryBidLogItem {
  id: string
  amount: number
  bidder_number: number
  donor_name: string | null
  table_number: string | null
  accepted_at: string
  status: string
}

export interface QuickEntryLiveSummary {
  mode: 'LIVE_AUCTION'
  item_id: string
  current_highest_bid: number
  bid_count: number
  unique_bidder_count: number
  bids: QuickEntryBidLogItem[]
  updated_at: string
}

export interface QuickEntryPaddleAmountLevel {
  amount: number
  count: number
}

export interface QuickEntryPaddleSummary {
  mode: 'PADDLE_RAISE'
  total_pledged: number
  donation_count: number
  unique_donor_count: number
  participation_percent: number
  by_amount_level: QuickEntryPaddleAmountLevel[]
  updated_at: string
}

export interface QuickEntryWinnerAssignmentResponse {
  item_id: string
  winner_bid_id: string
  winning_amount: number
  winner_bidder_number: number
  assigned_at: string
}

export interface CreatePaddleDonationPayload {
  amount: number
  bidder_number: number
  label_ids: string[]
  custom_label?: string
}

export interface PaddleDonationLabel {
  label: string
}

export interface QuickEntryPaddleDonationResponse {
  id: string
  event_id: string
  amount: number
  bidder_number: number
  donor_name: string | null
  entered_at: string
  entered_by: string
  labels: PaddleDonationLabel[]
}

export interface QuickEntryDonationLabel {
  id: string
  name: string
}

export interface QuickEntryDonationLabelList {
  items: QuickEntryDonationLabel[]
}

export async function getQuickEntryLiveAuctionItems(
  eventId: string
): Promise<AuctionItem[]> {
  const response = await apiClient.get<{ items: AuctionItem[] }>(
    `/events/${eventId}/auction-items`,
    {
      params: {
        auction_type: 'live',
        page: 1,
        limit: 100,
      },
    }
  )
  return response.data.items
}

export async function createLiveBid(
  eventId: string,
  payload: CreateLiveBidPayload
): Promise<LiveBidResponse> {
  const response = await apiClient.post(
    `/admin/events/${eventId}/quick-entry/live-auction/bids`,
    payload
  )
  return response.data
}

export async function getLiveAuctionSummary(
  eventId: string,
  itemId: string
): Promise<QuickEntryLiveSummary> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/quick-entry/summary`,
    {
      params: { mode: 'LIVE_AUCTION', item_id: itemId },
    }
  )
  return response.data
}

export async function deleteLiveBid(
  eventId: string,
  bidId: string
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/quick-entry/live-auction/bids/${bidId}`
  )
}

export async function assignWinner(
  eventId: string,
  itemId: string
): Promise<QuickEntryWinnerAssignmentResponse> {
  const response = await apiClient.post(
    `/admin/events/${eventId}/quick-entry/live-auction/items/${itemId}/winner`,
    { confirm: true }
  )
  return response.data
}

export async function removeWinner(
  eventId: string,
  itemId: string
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/quick-entry/live-auction/items/${itemId}/winner`
  )
}

export interface QuickEntryPaddleDonationListResponse {
  items: QuickEntryPaddleDonationResponse[]
}

export async function getPaddleDonations(
  eventId: string
): Promise<QuickEntryPaddleDonationListResponse> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/quick-entry/paddle-raise/donations`
  )
  return response.data
}

export async function createPaddleDonation(
  eventId: string,
  payload: CreatePaddleDonationPayload
): Promise<QuickEntryPaddleDonationResponse> {
  const response = await apiClient.post(
    `/admin/events/${eventId}/quick-entry/paddle-raise/donations`,
    payload
  )
  return response.data
}

export async function getPaddleRaiseSummary(
  eventId: string
): Promise<QuickEntryPaddleSummary> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/quick-entry/summary`,
    {
      params: { mode: 'PADDLE_RAISE' },
    }
  )
  return response.data
}

export async function getQuickEntryDonationLabels(
  eventId: string
): Promise<QuickEntryDonationLabelList> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/quick-entry/donation-labels`
  )
  return response.data
}

// ---------------------------------------------------------------------------
// Buy-It-Now
// ---------------------------------------------------------------------------

export interface QuickEntryBuyNowItem {
  id: string
  bid_number: number
  title: string
  buy_now_price: number
  primary_image_url: string | null
}

export interface QuickEntryBuyNowSummary {
  total_raised: number
  bid_count: number
}

export interface QuickEntryBuyNowBidResponse {
  id: string
  event_id: string
  item_id: string
  bidder_number: number
  donor_name: string | null
  amount: number
  entered_at: string
  entered_by: string
}

export interface CreateBuyNowBidPayload {
  item_id: string
  amount: number
  bidder_number: number
}

export interface QuickEntryLiveAuctionOverview {
  items_with_winner: number
  total_items: number
}

export async function getLiveAuctionOverview(
  eventId: string
): Promise<QuickEntryLiveAuctionOverview> {
  const response = await apiClient.get<QuickEntryLiveAuctionOverview>(
    `/admin/events/${eventId}/quick-entry/live-auction/overview`
  )
  return response.data
}

export async function getBuyNowSummary(
  eventId: string
): Promise<QuickEntryBuyNowSummary> {
  const response = await apiClient.get<QuickEntryBuyNowSummary>(
    `/admin/events/${eventId}/quick-entry/buy-now/summary`
  )
  return response.data
}

export async function getBuyNowItems(
  eventId: string
): Promise<QuickEntryBuyNowItem[]> {
  const response = await apiClient.get<{ items: QuickEntryBuyNowItem[] }>(
    `/admin/events/${eventId}/quick-entry/buy-now/items`
  )
  return response.data.items
}

export async function createBuyNowBid(
  eventId: string,
  payload: CreateBuyNowBidPayload
): Promise<QuickEntryBuyNowBidResponse> {
  const response = await apiClient.post(
    `/admin/events/${eventId}/quick-entry/buy-now/bids`,
    payload
  )
  return response.data
}

export async function getBuyNowBids(
  eventId: string,
  itemId: string
): Promise<QuickEntryBuyNowBidResponse[]> {
  const response = await apiClient.get<{
    items: QuickEntryBuyNowBidResponse[]
  }>(`/admin/events/${eventId}/quick-entry/buy-now/bids`, {
    params: { item_id: itemId },
  })
  return response.data.items
}

export async function deleteBuyNowBid(
  eventId: string,
  bidId: string
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/quick-entry/buy-now/bids/${bidId}`
  )
}

// ---------------------------------------------------------------------------
// Silent Auction
// ---------------------------------------------------------------------------

export interface QuickEntrySilentItem {
  id: string
  bid_number: number
  title: string
  starting_bid: number
  bid_increment: number
  current_bid_amount: number | null
  min_next_bid_amount: number | null
  bid_count: number
  primary_image_url: string | null
}

export interface QuickEntrySilentBidResponse {
  id: string
  event_id: string
  item_id: string
  bidder_number: number
  donor_name: string | null
  amount: number
  bid_status: string
  placed_at: string
}

export interface CreateSilentBidPayload {
  item_id: string
  amount: number
  bidder_number: number
}

export async function getSilentAuctionItems(
  eventId: string
): Promise<QuickEntrySilentItem[]> {
  const response = await apiClient.get<{ items: QuickEntrySilentItem[] }>(
    `/admin/events/${eventId}/quick-entry/silent-auction/items`
  )
  return response.data.items
}

export async function createSilentBid(
  eventId: string,
  payload: CreateSilentBidPayload
): Promise<QuickEntrySilentBidResponse> {
  const response = await apiClient.post(
    `/admin/events/${eventId}/quick-entry/silent-auction/bids`,
    payload
  )
  return response.data
}

export async function getSilentAuctionBids(
  eventId: string,
  itemId: string
): Promise<QuickEntrySilentBidResponse[]> {
  const response = await apiClient.get<{
    items: QuickEntrySilentBidResponse[]
  }>(`/admin/events/${eventId}/quick-entry/silent-auction/bids`, {
    params: { item_id: itemId },
  })
  return response.data.items
}
