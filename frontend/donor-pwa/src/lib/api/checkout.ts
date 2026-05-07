/**
 * Checkout API client — T008
 *
 * Covers the new session-based end-of-night checkout flow:
 *   GET    /payments/events/{id}/checkout/session
 *   PATCH  /payments/events/{id}/checkout/session
 *   POST   /payments/events/{id}/checkout/confirm
 *   GET    /payments/events/{id}/checkout/receipt
 *   POST   /payments/events/{id}/checkout/contact-admin
 *   GET    /payments/events/{id}/checkout/status
 */
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CheckoutItem {
  id: string
  name: string
  description?: string
  original_amount_cents: number
  adjusted_amount_cents?: number
  effective_amount_cents: number
  source_type: string
  display_order: number
  deleted_at?: string
}

export interface CheckoutSession {
  id: string
  event_id: string
  status: 'not_started' | 'in_progress' | 'complete'
  payment_method: 'card' | 'cash' | 'check' | 'daf'
  cover_processing_fee: boolean
  auctioneer_tip_cents: number
  platform_tip_cents: number
  subtotal_cents: number
  processing_fee_cents: number
  total_cents: number
  completed_at?: string
  receipt_url?: string
  items_updated_at?: string
  items: CheckoutItem[]
}

export interface UpdateCheckoutSessionRequest {
  payment_method?: 'card' | 'cash' | 'check' | 'daf'
  cover_processing_fee?: boolean
  auctioneer_tip_cents?: number
  platform_tip_cents?: number
}

export interface CheckoutConfirmRequest {
  payment_method: 'card' | 'cash' | 'check' | 'daf'
  payment_profile_id?: string
  acknowledged_items_updated_at?: string
}

export interface CheckoutStatus {
  checkout_open: boolean
  donor_visible: boolean
  scheduled_open_at?: string
  session_status?: 'not_started' | 'in_progress' | 'complete'
  cash_instructions?: string
  processing_fee_rate?: number
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getCheckoutSession(
  eventId: string
): Promise<CheckoutSession> {
  const response = await apiClient.get<CheckoutSession>(
    `/payments/events/${eventId}/checkout/session`
  )
  return response.data
}

export async function updateCheckoutSession(
  eventId: string,
  data: UpdateCheckoutSessionRequest
): Promise<CheckoutSession> {
  const response = await apiClient.patch<CheckoutSession>(
    `/payments/events/${eventId}/checkout/session`,
    data
  )
  return response.data
}

export async function confirmCheckout(
  eventId: string,
  data: CheckoutConfirmRequest
): Promise<CheckoutSession> {
  const response = await apiClient.post<CheckoutSession>(
    `/payments/events/${eventId}/checkout/confirm`,
    data
  )
  return response.data
}

/**
 * Download checkout receipt — fetches the PDF via the authenticated API client
 * and triggers a browser download. Falls back to window.open for external URLs.
 * Throws on network error or if the receipt is not yet available (503).
 */
export async function downloadCheckoutReceipt(eventId: string): Promise<void> {
  const { data } = await apiClient.get<{ url: string }>(
    `/payments/events/${eventId}/checkout/receipt`
  )
  const url = data.url

  // External blob storage URL — open directly
  if (url.startsWith('http')) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  // Relative API URL (e.g. /api/v1/payments/.../receipt/pdf) — fetch with auth
  const response = await apiClient.get<Blob>(url.replace(/^\/api\/v1/, ''), {
    responseType: 'blob',
  })

  // Extract filename from Content-Disposition header if present
  const disposition = response.headers['content-disposition'] as
    | string
    | undefined
  const match = disposition?.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'receipt.pdf'

  const blobUrl = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(blobUrl)
}

export async function contactAdmin(
  eventId: string,
  message: string
): Promise<void> {
  await apiClient.post(`/payments/events/${eventId}/checkout/contact-admin`, {
    message,
  })
}

export async function getCheckoutStatus(
  eventId: string
): Promise<CheckoutStatus> {
  const response = await apiClient.get<CheckoutStatus>(
    `/payments/events/${eventId}/checkout/status`
  )
  return response.data
}
