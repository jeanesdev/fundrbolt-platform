import apiClient from '@/lib/axios'
import type { AuctionItem } from '@/types/auction-item'

export async function getQuickEntryStatus(eventId: string): Promise<{ status: string }> {
  const response = await apiClient.get(`/admin/events/${eventId}/quick-entry/status`)
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

export async function getQuickEntryLiveAuctionItems(eventId: string): Promise<AuctionItem[]> {
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
  const response = await apiClient.get(`/admin/events/${eventId}/quick-entry/summary`, {
    params: { mode: 'LIVE_AUCTION', item_id: itemId },
  })
  return response.data
}

export async function deleteLiveBid(eventId: string, bidId: string): Promise<void> {
  await apiClient.delete(`/admin/events/${eventId}/quick-entry/live-auction/bids/${bidId}`)
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

export async function getPaddleRaiseSummary(eventId: string): Promise<QuickEntryPaddleSummary> {
  const response = await apiClient.get(`/admin/events/${eventId}/quick-entry/summary`, {
    params: { mode: 'PADDLE_RAISE' },
  })
  return response.data
}

export async function getQuickEntryDonationLabels(
  eventId: string
): Promise<QuickEntryDonationLabelList> {
  const response = await apiClient.get(`/admin/events/${eventId}/quick-entry/donation-labels`)
  return response.data
}
