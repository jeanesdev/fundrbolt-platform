/**
 * TypeScript types for payment processing.
 * Mirrors backend app/schemas/payment.py schemas.
 */

// ── NPO Gateway Credentials ───────────────────────────────────────────────────

export type GatewayName = 'deluxe' | 'stub'

/** POST/PUT /admin/npos/{npo_id}/payment-credentials request body */
export interface CredentialCreate {
  gateway_name: GatewayName
  merchant_id: string
  api_key: string
  api_secret: string
  gateway_id?: string | null
  is_live_mode: boolean
}

/** Response when credentials are configured — sensitive values are masked */
export interface CredentialRead {
  id: string
  npo_id: string
  gateway_name: GatewayName
  merchant_id_masked: string
  api_key_masked: string
  gateway_id?: string | null
  is_live_mode: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Response when no credentials are configured */
export interface CredentialNotConfigured {
  npo_id: string
  configured: false
}

export type CredentialResponse = CredentialRead | CredentialNotConfigured

export function isConfigured(r: CredentialResponse): r is CredentialRead {
  return (
    !('configured' in r) || (r as CredentialNotConfigured).configured !== false
  )
}

/** Response for POST /admin/npos/{npo_id}/payment-credentials/test */
export interface CredentialTestResponse {
  success: boolean
  message: string
  gateway_name?: string | null
  is_live_mode?: boolean | null
  latency_ms?: number | null
}

// ── Payment Profiles ──────────────────────────────────────────────────────────

export interface PaymentProfileRead {
  id: string
  npo_id: string
  gateway_profile_id: string
  card_last4: string
  card_brand: string
  card_expiry_month: number
  card_expiry_year: number
  billing_name?: string | null
  billing_zip?: string | null
  is_default: boolean
  created_at: string
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export interface LineItem {
  type: string
  label: string
  amount: string | number
}

export interface CheckoutBalanceResponse {
  event_id: string
  user_id: string
  total_balance: string
  line_items: LineItem[]
  processing_fee: string
  total_with_fee: string
}

export interface CheckoutResponse {
  transaction_id: string
  status: 'approved' | 'declined' | 'pending'
  amount_charged: string
  gateway_transaction_id?: string | null
  decline_reason?: string | null
}

// ── Admin Checkout Status ─────────────────────────────────────────────────────

export interface CheckoutStatusResponse {
  checkout_open: boolean
}

// ── Admin Donor Balances ──────────────────────────────────────────────────────

export interface DonorBalanceSummary {
  user_id: string
  first_name: string
  last_name: string
  email: string
  total_balance: string
  has_payment_profile: boolean
  payment_profile_id: string | null
}

export interface DonorListResponse {
  event_id: string
  donors: DonorBalanceSummary[]
  total_outstanding: string
}

// ── Admin Charge ──────────────────────────────────────────────────────────────

export interface AdminChargeRequest {
  user_id: string
  npo_id: string
  event_id?: string | null
  payment_profile_id: string
  line_items: LineItem[]
  total_amount: number
  reason: string
  idempotency_key?: string | null
}

export interface AdminChargeResponse {
  transaction_id: string
  status: string
  amount_charged: string
  gateway_transaction_id?: string | null
  decline_reason?: string | null
}

// ── Admin Transactions ────────────────────────────────────────────────────────

export interface TransactionListItem {
  transaction_id: string
  user_id: string
  user_email: string
  user_name: string
  status: string
  transaction_type: string
  amount: string
  gateway_transaction_id?: string | null
  created_at: string
}

export interface TransactionListResponse {
  event_id: string
  transactions: TransactionListItem[]
  total: number
}

// ── Void / Refund ─────────────────────────────────────────────────────────────

export interface VoidRequest {
  reason: string
}

export interface RefundRequest {
  amount: number
  reason: string
}

export interface RefundResponse {
  refund_transaction_id: string
  gateway_transaction_id?: string | null
  status: string
  amount_refunded: string
}

export interface VoidResponse {
  transaction_id: string
  parent_transaction_id: string
  status: string
}

// ── Admin HPF session + profile (check-in card entry) ─────────────────────────

export interface AdminPaymentSessionRequest {
  event_id: string | null
  npo_id?: string | null
  line_items: []
  save_profile: boolean
  return_url: string
  idempotency_key: string
}

export interface AdminPaymentSessionResponse {
  transaction_id: string
  session_token: string
  hpf_url: string
  expires_at: string
  amount_total: string
}

export interface AdminPaymentProfileCreate {
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
