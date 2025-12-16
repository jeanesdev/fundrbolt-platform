/**
 * Seating Service
 * API service for event seating configuration and management
 */

import api from './api'

export interface EventSeatingConfig {
  table_count: number
  max_guests_per_table: number
}

export interface EventSeatingConfigResponse {
  event_id: string
  table_count: number
  max_guests_per_table: number
  total_capacity: number
}

/**
 * Configure event seating (table count and max guests per table)
 */
export async function updateEventSeating(
  eventId: string,
  config: EventSeatingConfig,
): Promise<EventSeatingConfigResponse> {
  const response = await api.patch<EventSeatingConfigResponse>(
    `/admin/events/${eventId}/seating/config`,
    config,
  )
  return response.data
}

/**
 * Get available bidder numbers for an event
 */
export async function getAvailableBidderNumbers(
  eventId: string,
  limit = 10,
): Promise<{ available_numbers: number[]; total_available: number }> {
  const response = await api.get<{ available_numbers: number[]; total_available: number }>(
    `/admin/events/${eventId}/seating/bidder-numbers/available`,
    { params: { limit } },
  )
  return response.data
}
