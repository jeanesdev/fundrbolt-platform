/**
 * Admin Seating API Client
 *
 * Handles API requests for seating management including table assignments
 * and bidder number management.
 */

import apiClient from '@/lib/axios'

/**
 * Request to assign or reassign a bidder number to a guest
 */
export interface BidderNumberAssignmentRequest {
  bidder_number: number
}

/**
 * Response from bidder number assignment, includes conflict resolution info
 */
export interface BidderNumberAssignmentResponse {
  guest_id: string
  bidder_number: number
  assigned_at: string
  previous_holder_id?: string | null
}

/**
 * Request to assign a guest to a table
 */
export interface TableAssignmentRequest {
  table_number: number
}

/**
 * Response from table assignment
 */
export interface TableAssignmentResponse {
  guest_id: string
  table_number: number
  bidder_number?: number | null
}

/**
 * Guest seating information for admin views
 */
export interface GuestSeatingInfo {
  guest_id: string
  name: string | null
  email: string | null
  bidder_number: number | null
  table_number: number | null
  registration_id: string
  checked_in: boolean
}

/**
 * Paginated list of guests with seating information
 */
export interface GuestSeatingListResponse {
  guests: GuestSeatingInfo[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}

/**
 * Table occupancy information
 */
export interface TableOccupancyResponse {
  table_number: number
  current_occupancy: number
  max_capacity: number
  guests: GuestSeatingInfo[]
  is_full: boolean
}

/**
 * Auto-assign response with assignment results
 */
export interface AutoAssignResponse {
  assigned_count: number
  assignments: TableAssignmentResponse[]
  unassigned_count: number
  warnings: string[]
}

/**
 * Manually assign or reassign a bidder number to a guest
 *
 * If the bidder number is already assigned to another guest, the backend
 * will automatically swap the numbers (conflict resolution).
 *
 * @param eventId - Event UUID
 * @param guestId - Guest UUID
 * @param bidderNumber - Bidder number to assign (100-999)
 * @returns Assignment result with previous holder info if a swap occurred
 */
export const assignBidderNumber = async (
  eventId: string,
  guestId: string,
  bidderNumber: number
): Promise<BidderNumberAssignmentResponse> => {
  const response = await apiClient.patch<BidderNumberAssignmentResponse>(
    `/admin/events/${eventId}/guests/${guestId}/bidder-number`,
    { bidder_number: bidderNumber }
  )

  return response.data
}

/**
 * Assign a guest to a table
 *
 * Validates table number is within event configuration and checks capacity.
 *
 * @param eventId - Event UUID
 * @param guestId - Guest UUID
 * @param tableNumber - Table number to assign to
 * @returns Assignment result
 */
export const assignGuestToTable = async (
  eventId: string,
  guestId: string,
  tableNumber: number
): Promise<TableAssignmentResponse> => {
  const response = await apiClient.patch<TableAssignmentResponse>(
    `/admin/events/${eventId}/guests/${guestId}/table`,
    { table_number: tableNumber }
  )

  return response.data
}

/**
 * Remove a guest from their assigned table
 *
 * @param eventId - Event UUID
 * @param guestId - Guest UUID
 */
export const removeGuestFromTable = async (
  eventId: string,
  guestId: string
): Promise<void> => {
  await apiClient.delete(`/admin/events/${eventId}/guests/${guestId}/table`)
}

/**
 * Get paginated list of guests with seating information
 *
 * @param eventId - Event UUID
 * @param page - Page number (default 1)
 * @param perPage - Items per page (default 50)
 * @param tableFilter - Optional table number filter (0 for unassigned)
 * @returns Paginated guest list
 */
export const getSeatingGuests = async (
  eventId: string,
  page = 1,
  perPage = 50,
  tableFilter?: number | null
): Promise<GuestSeatingListResponse> => {
  const params: Record<string, number> = {
    page,
    per_page: perPage
  }

  // Only include table_filter if explicitly set to a number
  if (typeof tableFilter === 'number') {
    params.table_filter = tableFilter
  }

  const response = await apiClient.get<GuestSeatingListResponse>(
    `/admin/events/${eventId}/seating/guests`,
    { params }
  )

  return response.data
}

/**
 * Get occupancy information for a specific table
 *
 * @param eventId - Event UUID
 * @param tableNumber - Table number
 * @returns Occupancy details and guest list
 */
export const getTableOccupancy = async (
  eventId: string,
  tableNumber: number
): Promise<TableOccupancyResponse> => {
  const response = await apiClient.get<TableOccupancyResponse>(
    `/admin/events/${eventId}/seating/tables/${tableNumber}/occupancy`
  )

  return response.data
}

/**
 * Auto-assign unassigned guests to tables using party-aware algorithm
 *
 * @param eventId - Event ID
 * @returns Assignment results and warnings
 */
export const autoAssignGuests = async (
  eventId: string
): Promise<AutoAssignResponse> => {
  const response = await apiClient.post<AutoAssignResponse>(
    `/admin/events/${eventId}/seating/auto-assign`
  )

  return response.data
}
