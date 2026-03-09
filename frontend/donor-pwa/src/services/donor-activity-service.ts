/**
 * Donor event activity service
 *
 * Covers the new donor-facing endpoints:
 *   GET /api/v1/donor/events/{event_id}/guests        – all event guests directory
 *   GET /api/v1/donor/events/{event_id}/my-activity   – current user's bids + donations
 */
import apiClient from '@/lib/axios'

// ─── Guests directory ─────────────────────────────────────────────────────

export interface EventGuestItem {
  guest_id: string
  name: string | null
  bidder_number: number | null
  table_number: number | null
  table_name: string | null
  profile_image_url: string | null
  is_table_captain: boolean
}

export interface EventGuestsResponse {
  guests: EventGuestItem[]
  total: number
}

export async function getEventGuests(eventId: string): Promise<EventGuestsResponse> {
  const res = await apiClient.get<EventGuestsResponse>(
    `/donor/events/${eventId}/guests`
  )
  return res.data
}

// ─── My activity ─────────────────────────────────────────────────────────

export interface DonorBidItem {
  auction_item_id: string
  item_number: number
  item_title: string
  bid_amount: number
  bid_status: string
  placed_at: string
  primary_image_url: string | null
}

export interface DonorDonationItem {
  donation_id: string
  amount: number
  labels: string[]
  donated_at: string
}

export interface DonorActivityResponse {
  bids: DonorBidItem[]
  donations: DonorDonationItem[]
}

export async function getMyActivity(eventId: string): Promise<DonorActivityResponse> {
  const res = await apiClient.get<DonorActivityResponse>(
    `/donor/events/${eventId}/my-activity`
  )
  return res.data
}
