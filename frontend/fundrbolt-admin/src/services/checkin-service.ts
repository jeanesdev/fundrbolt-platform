/**
 * Check-in Service
 * API client for event check-in operations
 */

import { apiClient } from '@/lib/api-client'

export interface GuestSearchResult {
  registration_id: string
  donor_name: string | null
  email: string | null
  phone: string | null
  bidder_number: number | null
  table_number: number | null
  dinner_selection: string | null
  checkin_status: 'checked_in' | 'not_checked_in'
  checked_in_at: string | null
  checked_out_at: string | null
}

export interface CheckinSearchResponse {
  results: GuestSearchResult[]
}

export interface CheckinDashboardResponse {
  total_registered: number
  total_checked_in: number
  checked_in: GuestSearchResult[]
}

export interface CheckinStatusResponse {
  registration_id: string
  status: string
  checked_in_at: string | null
  checked_out_at: string | null
}

export interface CheckOutRequest {
  reason: string
}

export interface DonorUpdateRequest {
  full_name?: string
  email?: string
  phone?: string
}

export interface SeatingUpdateRequest {
  bidder_number?: number
  table_number?: number
}

export interface TransferRequest {
  to_donor_id: string
  note?: string
}

export const checkinService = {
  /**
   * Search for guests by name, phone, or email
   */
  searchGuests: async (eventId: string, query: string): Promise<CheckinSearchResponse> => {
    const { data } = await apiClient.get<CheckinSearchResponse>(
      `/admin/events/${eventId}/checkins/search`,
      {
        params: { q: query },
      }
    )
    return data
  },

  /**
   * Check in a guest
   */
  checkInGuest: async (eventId: string, registrationId: string): Promise<CheckinStatusResponse> => {
    const { data } = await apiClient.post<CheckinStatusResponse>(
      `/admin/events/${eventId}/checkins/${registrationId}/check-in`
    )
    return data
  },

  /**
   * Check out a guest (undo check-in)
   */
  checkOutGuest: async (
    eventId: string,
    registrationId: string,
    reason: string
  ): Promise<CheckinStatusResponse> => {
    const { data } = await apiClient.post<CheckinStatusResponse>(
      `/admin/events/${eventId}/checkins/${registrationId}/check-out`,
      { reason }
    )
    return data
  },

  /**
   * Get check-in dashboard data
   */
  getDashboard: async (eventId: string): Promise<CheckinDashboardResponse> => {
    const { data } = await apiClient.get<CheckinDashboardResponse>(
      `/admin/events/${eventId}/checkins/dashboard`
    )
    return data
  },

  /**
   * Update donor information
   */
  updateDonorInfo: async (
    eventId: string,
    registrationId: string,
    updates: DonorUpdateRequest
  ): Promise<any> => {
    const { data } = await apiClient.patch(
      `/admin/events/${eventId}/checkins/${registrationId}/donor`,
      updates
    )
    return data
  },

  /**
   * Update seating assignment
   */
  updateSeating: async (
    eventId: string,
    registrationId: string,
    seating: SeatingUpdateRequest
  ): Promise<any> => {
    const { data } = await apiClient.patch(
      `/admin/events/${eventId}/checkins/${registrationId}/seating`,
      seating
    )
    return data
  },

  /**
   * Transfer ticket to another donor
   */
  transferTicket: async (
    eventId: string,
    registrationId: string,
    transfer: TransferRequest
  ): Promise<any> => {
    const { data } = await apiClient.post(
      `/admin/events/${eventId}/checkins/${registrationId}/transfer`,
      transfer
    )
    return data
  },
}
