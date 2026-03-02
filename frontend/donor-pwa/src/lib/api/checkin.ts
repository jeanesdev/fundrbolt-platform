/**
 * Check-in API client for donor PWA
 */

import axiosClient from '../axios'

export interface CheckInLookupRequest {
  confirmation_code?: string
  email?: string
  event_id?: string
}

export interface RegistrationGuest {
  id: string
  registration_id: string
  user_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  invited_by_admin: boolean
  invitation_sent_at: string | null
  checked_in: boolean
  check_in_time: string | null
  status: string
  cancellation_reason: string | null
  cancellation_note: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface EventRegistration {
  id: string
  user_id: string
  event_id: string
  ticket_purchase_id: string | null
  status: string
  number_of_guests: number
  check_in_time: string | null
  created_at: string
  updated_at: string
  guests: RegistrationGuest[]
}

export interface CheckInLookupResponse {
  registrations: EventRegistration[]
  total: number
}

export interface CheckInResponse {
  success: boolean
  message: string
  registration?: EventRegistration
  guest?: RegistrationGuest
}

export const checkinApi = {
  /**
   * Lookup registration by confirmation code or email
   */
  lookup: async (request: CheckInLookupRequest): Promise<CheckInLookupResponse> => {
    const response = await axiosClient.post<CheckInLookupResponse>('/checkin/lookup', request)
    return response.data
  },

  /**
   * Check in a registration
   */
  checkInRegistration: async (registrationId: string): Promise<CheckInResponse> => {
    const response = await axiosClient.post<CheckInResponse>(`/checkin/registrations/${registrationId}`)
    return response.data
  },

  /**
   * Check in a guest
   */
  checkInGuest: async (guestId: string): Promise<CheckInResponse> => {
    const response = await axiosClient.post<CheckInResponse>(`/checkin/guests/${guestId}`)
    return response.data
  },

  /**
   * Undo check-in for a registration
   */
  undoCheckInRegistration: async (registrationId: string): Promise<CheckInResponse> => {
    const response = await axiosClient.delete<CheckInResponse>(`/checkin/registrations/${registrationId}`)
    return response.data
  },

  /**
   * Undo check-in for a guest
   */
  undoCheckInGuest: async (guestId: string): Promise<CheckInResponse> => {
    const response = await axiosClient.delete<CheckInResponse>(`/checkin/guests/${guestId}`)
    return response.data
  },
}
