/**
 * Quick Sale API Client
 *
 * Provides functions for quick ticket sales at check-in.
 */
import apiClient from '@/lib/axios'

// ================================
// Types
// ================================

export interface QuickSaleGuestInfo {
  name: string
  email?: string | null
  phone?: string | null
}

export interface QuickSaleRequest {
  ticket_package_id: string
  quantity: number
  buyer_name: string
  buyer_email: string
  buyer_phone?: string | null

  // Address fields
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null

  guests: QuickSaleGuestInfo[]
  payment_method?: string

  // Payment details
  card_last_four?: string | null
  check_number?: string | null

  // Bidder and table assignment (null = auto-assign)
  bidder_number?: number | null
  table_number?: number | null

  check_in_immediately?: boolean
  notes?: string | null
}

export interface QuickSaleGuestResult {
  id: string
  registration_id: string
  name: string
  email: string | null
  phone: string | null
  is_primary: boolean
  checked_in: boolean
  bidder_number: number | null
  table_number: number | null
}

export interface QuickSaleResponse {
  purchase_id: string
  registration_id: string
  confirmation_code: string
  ticket_count: number
  package_name: string
  total_amount: number
  payment_method: string
  guests: QuickSaleGuestResult[]
  message: string
}

// ================================
// API Functions
// ================================

/**
 * Create a quick ticket sale at check-in.
 */
export async function createQuickSale(
  eventId: string,
  request: QuickSaleRequest
): Promise<QuickSaleResponse> {
  const response = await apiClient.post<QuickSaleResponse>(
    `/admin/events/${eventId}/quick-sale`,
    request
  )
  return response.data
}
