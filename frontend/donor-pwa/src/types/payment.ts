/**
 * Payment types for the donor PWA.
 * Mirrors the Pydantic schemas in backend/app/schemas/payment.py.
 */

// ── Line Items ────────────────────────────────────────────────────────────────

export interface LineItem {
  type: 'ticket' | 'auction_win' | 'donation' | 'extra_tip' | 'fee_coverage' | string
  label: string
  amount: number
}

// ── HPF Session ───────────────────────────────────────────────────────────────

export interface PaymentSessionRequest {
  event_id: string | null
  npo_id?: string | null
  line_items: LineItem[]
  save_profile: boolean
  return_url: string
  idempotency_key: string
}

export interface PaymentSessionResponse {
  transaction_id: string
  session_token: string
  hpf_url: string
  expires_at: string
  amount_total: string
}

// ── Payment Profiles ──────────────────────────────────────────────────────────

export interface PaymentProfileCreate {
  npo_id: string
  gateway_profile_id: string
  card_last4: string
  card_brand: string
  card_expiry_month: number
  card_expiry_year: number
  billing_name?: string | null
  billing_zip?: string | null
  is_default?: boolean
}

export interface PaymentProfile {
  id: string
  npo_id: string
  gateway_profile_id: string
  card_last4: string
  card_brand: string
  card_expiry_month: number
  card_expiry_year: number
  billing_name: string | null
  billing_zip: string | null
  is_default: boolean
  created_at: string
}

export interface DeleteProfileResponse {
  warning: string | null
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export interface CheckoutRequest {
  event_id: string
  payment_profile_id: string
  /** If true, processing fee is added to the charge and included as a line item. */
  cover_processing_fee?: boolean
  /** Informational; server re-derives balance. */
  line_items?: LineItem[]
  /** Informational; server re-derives balance. */
  total_amount?: number
  idempotency_key?: string | null
}

export interface CheckoutResponse {
  transaction_id: string
  /** 'approved' | 'declined' | 'pending' */
  status: 'approved' | 'declined' | 'pending'
  amount_charged: number
  gateway_transaction_id?: string | null
  decline_reason?: string | null
  /** True when the receipt email has been queued but not yet sent. */
  receipt_pending: boolean
}

export interface CheckoutBalanceResponse {
  event_id: string
  user_id: string
  total_balance: number
  line_items: LineItem[]
  processing_fee: number
  total_with_fee: number
}

export interface PromoCodeValidation {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  description?: string | null
}

// ── HPF postMessage payload ───────────────────────────────────────────────────

export interface HpfCompletePayload {
  source: 'fundrbolt-hpf'
  type: 'hpf_complete'
  status: 'approved' | 'declined'
  token: string
  transactionId: string
  // Present on approved
  gatewayProfileId?: string
  cardLast4?: string
  cardBrand?: string
  cardExpiryMonth?: number
  cardExpiryYear?: number
  // Present on declined
  declineReason?: string
}
