/**
 * Admin Checkout API Client
 *
 * Wraps all /api/v1/admin/events/{eventId}/checkout/* endpoints
 * and /api/v1/admin/processing-fee-config endpoints.
 */
import apiClient from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckoutStatus = 'open' | 'closed' | 'scheduled'
export type DonorCheckoutStatus = 'not_started' | 'in_progress' | 'complete'
export type CheckoutItemSource =
  | 'auction_bid'
  | 'ticket_purchase'
  | 'donation'
  | 'manual'

export interface CheckoutConfiguration {
  event_id: string
  status: CheckoutStatus
  cash_instructions: string | null
  scheduled_open_at: string | null
  created_at: string
  updated_at: string
}

export interface UpdateCheckoutConfigRequest {
  cash_instructions?: string | null
  scheduled_open_at?: string | null
}

export interface CheckoutItem {
  id: string
  name: string
  description: string | null
  original_amount_cents: number
  adjusted_amount_cents: number | null
  source_type: CheckoutItemSource
  source_id: string | null
  is_removed: boolean
  created_at: string
  updated_at: string
}

export interface DonorCheckoutSession {
  user_id: string
  first_name: string
  last_name: string
  email: string
  status: DonorCheckoutStatus
  items: CheckoutItem[]
  subtotal_cents: number
  processing_fee_cents: number
  total_cents: number
  completed_at: string | null
  receipt_url: string | null
}

export interface DonorCheckoutSummary {
  user_id: string
  first_name: string
  last_name: string
  email: string
  status: DonorCheckoutStatus
  item_count: number
  total_cents: number
}

export interface DonorCheckoutListResponse {
  event_id: string
  donors: DonorCheckoutSummary[]
  total: number
  page: number
  per_page: number
  counts: {
    not_started: number
    in_progress: number
    complete: number
  }
}

export interface AddCheckoutItemRequest {
  name: string
  description?: string | null
  amount_cents: number
  source_type: CheckoutItemSource
}

export interface CheckoutNotificationResponse {
  dispatched: number
}

export interface ProcessingFeeConfig {
  id: string
  rate: number
  created_at: string
}

export interface ProcessingFeeHistoryEntry {
  id: string
  rate: number
  created_at: string
}

export interface ProcessingFeeHistoryResponse {
  items: ProcessingFeeHistoryEntry[]
  total: number
  page: number
  per_page: number
  pages: number
}

// ── Checkout Configuration ─────────────────────────────────────────────────────

export async function getCheckoutConfiguration(
  eventId: string
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.get<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/configuration`
  )
  return data
}

export async function updateCheckoutConfiguration(
  eventId: string,
  payload: UpdateCheckoutConfigRequest
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.patch<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/configuration`,
    payload
  )
  return data
}

// ── Checkout Open/Close ────────────────────────────────────────────────────────

export async function openCheckout(
  eventId: string
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.post<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/open`
  )
  return data
}

export async function closeCheckout(
  eventId: string
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.post<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/close`
  )
  return data
}

// ── Scheduled Open ─────────────────────────────────────────────────────────────

export async function scheduleCheckoutOpen(
  eventId: string,
  scheduledOpenAt: string
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.post<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/schedule`,
    { open_at: scheduledOpenAt }
  )
  return data
}

export async function cancelScheduledOpen(
  eventId: string
): Promise<CheckoutConfiguration> {
  const { data } = await apiClient.delete<CheckoutConfiguration>(
    `/admin/events/${eventId}/checkout/schedule`
  )
  return data
}

// ── Donor Checkout Status List ─────────────────────────────────────────────────

export async function listDonorCheckoutStatus(
  eventId: string,
  params?: { page?: number; per_page?: number; status?: string }
): Promise<DonorCheckoutListResponse> {
  const { data } = await apiClient.get<DonorCheckoutListResponse>(
    `/admin/events/${eventId}/checkout/donors`,
    { params }
  )
  return data
}

// ── Donor Session ──────────────────────────────────────────────────────────────

export async function getDonorCheckoutSession(
  eventId: string,
  userId: string
): Promise<DonorCheckoutSession> {
  const { data } = await apiClient.get<DonorCheckoutSession>(
    `/admin/events/${eventId}/checkout/donors/${userId}/session`
  )
  return data
}

// ── Checkout Items ─────────────────────────────────────────────────────────────

export async function addCheckoutItem(
  eventId: string,
  userId: string,
  payload: AddCheckoutItemRequest
): Promise<CheckoutItem> {
  const { data } = await apiClient.post<CheckoutItem>(
    `/admin/events/${eventId}/checkout/donors/${userId}/items`,
    payload
  )
  return data
}

export async function repriceCheckoutItem(
  eventId: string,
  userId: string,
  itemId: string,
  adjustedAmountCents: number
): Promise<CheckoutItem> {
  const { data } = await apiClient.patch<CheckoutItem>(
    `/admin/events/${eventId}/checkout/donors/${userId}/items/${itemId}`,
    { adjusted_amount_cents: adjustedAmountCents }
  )
  return data
}

export async function removeCheckoutItem(
  eventId: string,
  userId: string,
  itemId: string
): Promise<void> {
  await apiClient.delete(
    `/admin/events/${eventId}/checkout/donors/${userId}/items/${itemId}`
  )
}

// ── Notifications ──────────────────────────────────────────────────────────────

export async function sendCheckoutLink(
  eventId: string,
  userIds?: string[]
): Promise<CheckoutNotificationResponse> {
  const { data } = await apiClient.post<CheckoutNotificationResponse>(
    `/admin/events/${eventId}/checkout/notifications/send-link`,
    userIds ? { user_ids: userIds } : {}
  )
  return data
}

export async function sendCheckoutReminder(
  eventId: string,
  userIds?: string[]
): Promise<CheckoutNotificationResponse> {
  const { data } = await apiClient.post<CheckoutNotificationResponse>(
    `/admin/events/${eventId}/checkout/notifications/send-reminder`,
    userIds ? { user_ids: userIds } : {}
  )
  return data
}

// ── Receipt ────────────────────────────────────────────────────────────────────

export async function downloadDonorReceipt(
  eventId: string,
  userId: string
): Promise<void> {
  const response = await apiClient.get(
    `/admin/events/${eventId}/checkout/donors/${userId}/receipt`,
    { responseType: 'blob' }
  )
  const disposition: string = response.headers['content-disposition'] ?? ''
  const match =
    disposition.match(/filename="([^"]+)"/) ??
    disposition.match(/filename=([^;\s]+)/)
  const filename = match ? match[1] : `receipt-${userId.slice(0, 8)}.pdf`
  const url = URL.createObjectURL(response.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function adminResendReceipt(
  eventId: string,
  userId: string
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(
    `/admin/events/${eventId}/checkout/donors/${userId}/receipt/resend`
  )
  return data
}

// ── Processing Fee Config ──────────────────────────────────────────────────────

export async function getProcessingFeeConfig(): Promise<ProcessingFeeConfig> {
  const { data } = await apiClient.get<ProcessingFeeConfig>(
    '/admin/processing-fee-config'
  )
  return data
}

export async function setProcessingFeeRate(
  rate: number
): Promise<ProcessingFeeConfig> {
  const { data } = await apiClient.post<ProcessingFeeConfig>(
    '/admin/processing-fee-config',
    { rate }
  )
  return data
}

export async function getProcessingFeeHistory(
  page?: number
): Promise<ProcessingFeeHistoryResponse> {
  const { data } = await apiClient.get<ProcessingFeeHistoryResponse>(
    '/admin/processing-fee-config/history',
    { params: page ? { page } : undefined }
  )
  return data
}
