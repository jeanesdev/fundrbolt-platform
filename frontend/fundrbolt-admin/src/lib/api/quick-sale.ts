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
  guests: QuickSaleGuestInfo[]
  payment_method?: string
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
