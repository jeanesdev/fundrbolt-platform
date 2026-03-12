/**
 * Admin Payments API Client
 *
 * Wraps all /api/v1/admin/payments/* endpoints.
 */
import type {
  AdminChargeRequest,
  AdminChargeResponse,
  AdminPaymentProfileCreate,
  AdminPaymentSessionRequest,
  AdminPaymentSessionResponse,
  CheckoutStatusResponse,
  DonorListResponse,
  PaymentProfileRead,
  RefundRequest,
  RefundResponse,
  TransactionListResponse,
  VoidRequest,
  VoidResponse,
} from '@/types/payments'
import apiClient from '@/lib/axios'

// ── Checkout Status ────────────────────────────────────────────────────────────

export async function getCheckoutStatus(
  eventId: string
): Promise<CheckoutStatusResponse> {
  const { data } = await apiClient.get<CheckoutStatusResponse>(
    '/admin/payments/checkout/status',
    { params: { event_id: eventId } }
  )
  return data
}

export async function setCheckoutStatus(
  eventId: string,
  checkoutOpen: boolean
): Promise<CheckoutStatusResponse> {
  const { data } = await apiClient.patch<CheckoutStatusResponse>(
    '/admin/payments/checkout/status',
    { checkout_open: checkoutOpen },
    { params: { event_id: eventId } }
  )
  return data
}

// ── Donor Balances ─────────────────────────────────────────────────────────────

export async function getDonorBalances(
  eventId: string
): Promise<DonorListResponse> {
  const { data } = await apiClient.get<DonorListResponse>(
    '/admin/payments/donors',
    { params: { event_id: eventId } }
  )
  return data
}

// ── Admin Force Charge ─────────────────────────────────────────────────────────

export async function adminChargeDonor(
  payload: AdminChargeRequest
): Promise<AdminChargeResponse> {
  const { data } = await apiClient.post<AdminChargeResponse>(
    '/admin/payments/charge',
    payload
  )
  return data
}

// ── Transaction List ───────────────────────────────────────────────────────────

export async function getEventTransactions(
  eventId: string
): Promise<TransactionListResponse> {
  const { data } = await apiClient.get<TransactionListResponse>(
    '/admin/payments/transactions',
    { params: { event_id: eventId } }
  )
  return data
}

// ── Void / Refund ──────────────────────────────────────────────────────────────

export async function voidTransaction(
  transactionId: string,
  payload: VoidRequest
): Promise<VoidResponse> {
  const { data } = await apiClient.post<VoidResponse>(
    `/admin/payments/${transactionId}/void`,
    payload
  )
  return data
}

export async function refundTransaction(
  transactionId: string,
  payload: RefundRequest
): Promise<RefundResponse> {
  const { data } = await apiClient.post<RefundResponse>(
    `/admin/payments/${transactionId}/refund`,
    payload
  )
  return data
}

// ── Admin-on-behalf HPF session + profile (check-in card entry) ──────────────

export async function adminCreatePaymentSession(
  userId: string,
  payload: AdminPaymentSessionRequest
): Promise<AdminPaymentSessionResponse> {
  const { data } = await apiClient.post<AdminPaymentSessionResponse>(
    `/admin/payments/users/${userId}/session`,
    payload
  )
  return data
}

export async function adminCreatePaymentProfile(
  userId: string,
  payload: AdminPaymentProfileCreate
): Promise<PaymentProfileRead> {
  const { data } = await apiClient.post<PaymentProfileRead>(
    `/admin/payments/users/${userId}/profiles`,
    payload
  )
  return data
}
