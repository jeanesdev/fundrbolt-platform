/**
 * Admin Attendees API Client
 *
 * Handles API requests for event attendee management, meal summaries, and guest invitations.
 */

import apiClient from '@/lib/axios'

export interface Attendee {
  id: string
  registration_id: string
  attendee_type: 'registrant' | 'guest'
  name: string
  email: string
  phone: string
  number_of_guests?: number
  ticket_type?: string
  guest_of?: string
  meal_selection?: string | null
  meal_description?: string | null
  status: string
  created_at: string
}

export interface AttendeesResponse {
  attendees: Attendee[]
  total: number
}

export interface MealCount {
  food_option_id: string
  name: string
  description: string
  count: number
}

export interface MealSummaryResponse {
  event_id: string
  event_name: string
  total_registrations: number
  total_attendees: number
  total_meal_selections: number
  meal_counts: MealCount[]
}

export interface InvitationResponse {
  message: string
}

/**
 * Get all attendees for an event
 *
 * @param eventId - Event UUID
 * @param includeMealSelections - Include meal selection data
 * @param format - Response format ("json" or "csv")
 * @returns Attendees list or CSV blob
 */
export const getEventAttendees = async (
  eventId: string,
  includeMealSelections = false,
  format: 'json' | 'csv' = 'json'
): Promise<AttendeesResponse | Blob> => {
  const response = await apiClient.get<AttendeesResponse | Blob>(
    `/admin/events/${eventId}/attendees`,
    {
      params: {
        include_meal_selections: includeMealSelections,
        format,
      },
      responseType: format === 'csv' ? 'blob' : 'json',
    }
  )

  return response.data
}

/**
 * Get meal selection summary for an event
 *
 * @param eventId - Event UUID
 * @returns Meal summary with counts
 */
export const getMealSummary = async (
  eventId: string
): Promise<MealSummaryResponse> => {
  const response = await apiClient.get<MealSummaryResponse>(
    `/admin/events/${eventId}/meal-summary`
  )

  return response.data
}

/**
 * Send invitation email to a guest
 *
 * @param guestId - Guest UUID
 * @returns Success message
 */
export const sendGuestInvitation = async (
  guestId: string
): Promise<InvitationResponse> => {
  const response = await apiClient.post<InvitationResponse>(
    `/admin/guests/${guestId}/send-invitation`
  )

  return response.data
}

/**
 * Download attendees as CSV file
 *
 * @param eventId - Event UUID
 * @param includeMealSelections - Include meal selection data
 * @returns CSV file download
 */
export const downloadAttendeesCSV = async (
  eventId: string,
  includeMealSelections = false
): Promise<void> => {
  const blob = (await getEventAttendees(
    eventId,
    includeMealSelections,
    'csv'
  )) as Blob

  // Create download link
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `attendees_${eventId}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Invite a new guest to an event (admin-initiated)
 *
 * @param eventId - Event UUID
 * @param guestData - Guest information
 * @returns Created guest with invitation status
 */
export const inviteGuestToEvent = async (
  eventId: string,
  guestData: {
    name: string
    email: string
    phone?: string
    custom_message?: string
  }
): Promise<{
  guest_id: string
  name: string
  email: string
  email_sent: boolean
  message: string
}> => {
  const response = await apiClient.post<{
    guest_id: string
    name: string
    email: string
    email_sent: boolean
    message: string
  }>(`/admin/events/${eventId}/invite-guest`, guestData)

  return response.data
}

/**
 * Delete a guest from an event
 *
 * @param guestId - Guest UUID
 * @returns void
 */
export const deleteGuest = async (guestId: string): Promise<void> => {
  await apiClient.delete(`/admin/guests/${guestId}`)
}
