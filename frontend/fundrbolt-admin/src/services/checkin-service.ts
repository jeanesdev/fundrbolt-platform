import apiClient from '@/lib/axios'

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

export interface RegistrationDetailsUpdateRequest {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

export interface GuestDetailsUpdateRequest {
  name?: string
  email?: string
  phone?: string
}

class CheckInService {
  async lookup(request: CheckInLookupRequest): Promise<CheckInLookupResponse> {
    const response = await apiClient.post<CheckInLookupResponse>(
      '/checkin/lookup',
      request
    )
    return response.data
  }

  async checkInRegistration(registrationId: string): Promise<CheckInResponse> {
    const response = await apiClient.post<CheckInResponse>(
      `/checkin/registrations/${registrationId}`
    )
    return response.data
  }

  async checkInGuest(guestId: string): Promise<CheckInResponse> {
    const response = await apiClient.post<CheckInResponse>(
      `/checkin/guests/${guestId}`
    )
    return response.data
  }

  async undoCheckInRegistration(
    registrationId: string
  ): Promise<CheckInResponse> {
    const response = await apiClient.delete<CheckInResponse>(
      `/checkin/registrations/${registrationId}`
    )
    return response.data
  }

  async undoCheckInGuest(guestId: string): Promise<CheckInResponse> {
    const response = await apiClient.delete<CheckInResponse>(
      `/checkin/guests/${guestId}`
    )
    return response.data
  }

  async updateRegistrationDetails(
    eventId: string,
    registrationId: string,
    payload: RegistrationDetailsUpdateRequest
  ): Promise<void> {
    await apiClient.patch(
      `/admin/events/${eventId}/registrations/${registrationId}/details`,
      payload
    )
  }

  async updateGuestDetails(
    eventId: string,
    guestId: string,
    payload: GuestDetailsUpdateRequest
  ): Promise<void> {
    await apiClient.patch(
      `/admin/events/${eventId}/guests/${guestId}/details`,
      payload
    )
  }

  async replaceGuestUser(
    eventId: string,
    guestId: string,
    email: string
  ): Promise<void> {
    await apiClient.post(
      `/admin/events/${eventId}/guests/${guestId}/replace-user`,
      {
        email,
      }
    )
  }
}

export const checkinService = new CheckInService()
export default checkinService
