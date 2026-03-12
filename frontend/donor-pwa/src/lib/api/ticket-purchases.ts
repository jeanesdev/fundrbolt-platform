/**
 * Ticket Purchases API Client
 *
 * Provides functions for ticket purchasing, cart validation,
 * purchase history, and inventory management.
 */
import apiClient from '@/lib/axios'

// ================================
// Types
// ================================

export interface CartItem {
  package_id: string
  quantity: number
}

export interface SponsorshipDetails {
  company_name: string
  logo_blob_name: string
  website_url?: string | null
  contact_name?: string | null
  contact_email?: string | null
}

export interface CheckoutRequest {
  items: CartItem[]
  promo_code?: string | null
  payment_profile_id?: string | null
  sponsorship_details?: SponsorshipDetails | null
}

export interface CartItemValidation {
  package_id: string
  package_name: string
  quantity: number
  unit_price: number
  line_total: number
  quantity_remaining: number | null
  is_sold_out: boolean
  warning: string | null
}

export interface CartValidationResponse {
  items: CartItemValidation[]
  subtotal: number
  discount: number
  promo_code_applied: string | null
  total: number
  warnings: string[]
  per_donor_limit: number | null
  current_donor_ticket_count: number
}

export interface PurchaseSummary {
  purchase_id: string
  package_name: string
  quantity: number
  total_price: number
  ticket_numbers: string[]
}

export interface CheckoutResponse {
  success: boolean
  purchases: PurchaseSummary[]
  total_charged: number
  transaction_id: string | null
  receipt_url: string | null
}

export interface AssignmentSummary {
  id: string
  guest_name: string
  guest_email: string
  status: string
  is_self_assignment: boolean
  invitation_sent_at: string | null
  invitation_count: number
  registered_at: string | null
}

export interface TicketDetail {
  id: string
  ticket_number: number
  qr_code: string
  assignment_status: string
  assignment: AssignmentSummary | null
}

export interface PurchaseDetail {
  id: string
  package_name: string
  package_id: string
  quantity: number
  total_price: number
  purchased_at: string
  payment_status: string
  tickets: TicketDetail[]
}

export interface EventTicketSummary {
  event_id: string
  event_name: string
  event_slug: string
  event_date: string
  total_tickets: number
  assigned_count: number
  registered_count: number
  unassigned_count: number
  purchases: PurchaseDetail[]
}

export interface TicketInventoryResponse {
  events: EventTicketSummary[]
  total_tickets: number
  total_assigned: number
  total_registered: number
  total_unassigned: number
}

export interface PurchaseHistoryItem {
  id: string
  event_name: string
  event_slug: string
  event_date: string
  package_name: string
  quantity: number
  total_price: number
  discount_amount: number
  promo_code: string | null
  payment_status: string
  purchased_at: string
  receipt_url: string | null
}

export interface PurchaseHistoryResponse {
  purchases: PurchaseHistoryItem[]
  total_count: number
  page: number
  per_page: number
}

export interface SponsorLogoUploadResponse {
  blob_name: string
  preview_url: string
}

// ================================
// API Functions
// ================================

/**
 * Get publicly visible ticket packages for an event.
 */
export async function getPublicTickets(slug: string) {
  const response = await apiClient.get(`/events/${slug}/tickets`)
  return response.data
}

/**
 * Validate cart items and apply promo code (if provided).
 */
export async function validateCart(
  eventId: string,
  items: CartItem[],
  promoCode?: string | null
) {
  const response = await apiClient.post<CartValidationResponse>(
    `/events/${eventId}/tickets/validate-cart`,
    { items, promo_code: promoCode }
  )
  return response.data
}

/**
 * Submit a ticket purchase checkout.
 */
export async function checkout(eventId: string, request: CheckoutRequest) {
  const response = await apiClient.post<CheckoutResponse>(
    `/events/${eventId}/tickets/checkout`,
    request
  )
  return response.data
}

/**
 * Get the current donor's purchases for an event.
 */
export async function getMyPurchases(eventId: string) {
  const response = await apiClient.get<{ purchases: PurchaseDetail[] }>(
    `/events/${eventId}/tickets/purchases`
  )
  return response.data
}

/**
 * Get the current donor's full ticket inventory across all events.
 */
export async function getMyInventory() {
  const response = await apiClient.get<TicketInventoryResponse>(
    '/tickets/my-inventory'
  )
  return response.data
}

/**
 * Get paginated purchase history for the current donor.
 */
export async function getPurchaseHistory(page = 1, perPage = 20) {
  const response = await apiClient.get<PurchaseHistoryResponse>(
    '/tickets/purchase-history',
    { params: { page, per_page: perPage } }
  )
  return response.data
}

/**
 * Upload a sponsor logo for a sponsorship ticket package purchase.
 */
export async function uploadSponsorLogo(eventId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post<SponsorLogoUploadResponse>(
    `/events/${eventId}/tickets/sponsorship-logo`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}
