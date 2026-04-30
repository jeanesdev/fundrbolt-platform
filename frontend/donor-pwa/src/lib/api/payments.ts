/**
 * Payment API client for the donor PWA.
 *
 * T030 — Phase 4.
 * T038 — Phase 6 (checkout + promo validation added).
 *
 * Endpoints covered:
 *   POST   /payments/session
 *   GET    /payments/profiles
 *   POST   /payments/profiles
 *   DELETE /payments/profiles/{id}
 *   PATCH  /payments/profiles/{id}/default
 *   POST   /payments/checkout
 *   GET    /admin/events/{event_id}/promo-codes/validate/{code}
 */
import type {
  CheckoutRequest,
  CheckoutResponse,
  DeleteProfileResponse,
  PaymentProfile,
  PaymentProfileCreate,
  PaymentSessionRequest,
  PaymentSessionResponse,
  PromoCodeValidation,
} from '@/types/payment'
import apiClient from '@/lib/axios'

// ── HPF Session ───────────────────────────────────────────────────────────────

/**
 * Create a hosted payment form session.
 * Returns the HPF URL to embed in an iframe.
 */
export async function createPaymentSession(
  data: PaymentSessionRequest
): Promise<PaymentSessionResponse> {
  const response = await apiClient.post<PaymentSessionResponse>(
    '/payments/session',
    data
  )
  return response.data
}

// ── Payment Profiles ──────────────────────────────────────────────────────────

/**
 * List a donor's saved cards for a given NPO.
 */
export async function listPaymentProfiles(
  npoId: string
): Promise<PaymentProfile[]> {
  const response = await apiClient.get<PaymentProfile[]>('/payments/profiles', {
    params: { npo_id: npoId },
  })
  return response.data
}

/**
 * Save a tokenised card vault reference after HPF completion.
 */
export async function createPaymentProfile(
  data: PaymentProfileCreate
): Promise<PaymentProfile> {
  const response = await apiClient.post<PaymentProfile>(
    '/payments/profiles',
    data
  )
  return response.data
}

/**
 * Soft-delete a saved card (calls gateway vault delete first).
 * Returns a warning string if the donor has an outstanding balance.
 */
export async function deletePaymentProfile(
  profileId: string,
  npoId: string
): Promise<DeleteProfileResponse> {
  const response = await apiClient.delete<DeleteProfileResponse>(
    `/payments/profiles/${profileId}`,
    { params: { npo_id: npoId } }
  )
  return response.data
}

/**
 * Promote a saved card to be the default for a given NPO.
 */
export async function setDefaultPaymentProfile(
  profileId: string,
  npoId: string
): Promise<PaymentProfile> {
  const response = await apiClient.patch<PaymentProfile>(
    `/payments/profiles/${profileId}/default`,
    null,
    { params: { npo_id: npoId } }
  )
  return response.data
}

// ── Checkout ─────────────────────────────────────────────────────────────────

/**
 * Submit a checkout using a saved payment profile.
 * Returns zero-balance response if no charge is needed.
 */
export async function submitCheckout(
  data: CheckoutRequest
): Promise<CheckoutResponse> {
  const response = await apiClient.post<CheckoutResponse>(
    '/payments/checkout',
    data
  )
  return response.data
}

/**
 * Validate a promo code for an event.
 * Returns the code details (discount type + value) or throws on invalid code.
 */
export async function validatePromoCode(
  eventId: string,
  code: string
): Promise<PromoCodeValidation> {
  const response = await apiClient.post<PromoCodeValidation>(
    `/admin/events/${eventId}/promo-codes/validate/${code}`
  )
  return response.data
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface TransactionDetail {
  id: string
  status: string
  transaction_type: string
  amount: number
  currency: string
  line_items: import('@/types/payment').LineItem[] | null
  created_at: string
  receipt_url: string | null
  card_last4: string | null
  card_brand: string | null
  event_name: string | null
  npo_name: string | null
}

/**
 * Fetch a transaction's full details (donor-own or admin).
 */
export async function getTransaction(
  transactionId: string
): Promise<TransactionDetail> {
  const response = await apiClient.get<TransactionDetail>(
    `/payments/transactions/${transactionId}`
  )
  return response.data
}

// ── Checkout balance ──────────────────────────────────────────────────────────

/**
 * Fetch the current donor's outstanding balance for an event.
 * Used to populate the end-of-night self-checkout screen.
 */
export async function getCheckoutBalance(
  eventId: string
): Promise<import('@/types/payment').CheckoutBalanceResponse> {
  const response = await apiClient.get<
    import('@/types/payment').CheckoutBalanceResponse
  >('/payments/checkout/balance', { params: { event_id: eventId } })
  return response.data
}
