/**
 * Seating Service
 * API service for event seating configuration and management
 */

import api from '@/lib/axios'

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

// Feature 014: Table Customization Types and API Functions

export interface TableCaptain {
  id: string
  first_name: string
  last_name: string
}

export interface EventTableDetails {
  id: string
  event_id: string
  table_number: number
  custom_capacity: number | null
  table_name: string | null
  table_captain: TableCaptain | null
  current_occupancy: number
  effective_capacity: number
  is_full: boolean
  updated_at: string
}

export interface EventTablesListResponse {
  event_id: string
  event_max_guests_per_table: number | null
  tables: EventTableDetails[]
  summary: {
    total_tables: number
    total_capacity: number
    total_assigned: number
    tables_full: number
    tables_with_captains: number
  }
}

export interface UpdateTableDetailsRequest {
  custom_capacity?: number | null
  table_name?: string | null
  table_captain_id?: string | null
}

/**
 * Update table customization details (capacity, name, captain)
 * Feature 014: T030
 */
export async function updateTableDetails(
  eventId: string,
  tableNumber: number,
  updates: UpdateTableDetailsRequest,
): Promise<EventTableDetails> {
  const response = await api.patch<EventTableDetails>(
    `/admin/events/${eventId}/tables/${tableNumber}`,
    updates,
  )
  return response.data
}

/**
 * Get all tables for an event with customization details
 * Feature 014: T031
 */
export async function fetchEventTables(
  eventId: string,
  includeGuests = false,
): Promise<EventTablesListResponse> {
  const response = await api.get<EventTablesListResponse>(
    `/admin/events/${eventId}/tables`,
    { params: { include_guests: includeGuests } },
  )
  return response.data
}
