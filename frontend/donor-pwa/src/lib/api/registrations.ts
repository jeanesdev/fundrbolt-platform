/**
 * Event Registration API Client
 *
 * Provides functions for managing event registrations in the donor PWA.
 */

import apiClient from '@/lib/axios'
import type { RegisteredEventsResponse } from '@/types/event-branding'
import type { AxiosResponse } from 'axios'

// ================================
// Types
// ================================

export interface EventRegistrationCreateRequest {
  event_id: string
  ticket_purchase_id?: string | null
  number_of_guests: number
  ticket_type?: string | null
}

export interface EventRegistrationUpdateRequest {
  ticket_purchase_id?: string | null
  number_of_guests?: number
  ticket_type?: string | null
  status?: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
}

export interface EventRegistrationResponse {
  id: string
  user_id: string
  event_id: string
  ticket_purchase_id: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
  ticket_type: string | null
  number_of_guests: number
  created_at: string
  updated_at: string
}

export interface EventRegistrationListResponse {
  registrations: EventRegistrationResponse[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ================================
// API Functions
// ================================

/**
 * Create a new event registration
 */
export async function createRegistration(
  data: EventRegistrationCreateRequest
): Promise<EventRegistrationResponse> {
  const response: AxiosResponse<EventRegistrationResponse> = await apiClient.post(
    '/registrations',
    data
  )
  return response.data
}

/**
 * Get all registrations for the current user
 */
export async function getUserRegistrations(params?: {
  status?: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
  page?: number
  per_page?: number
}): Promise<EventRegistrationListResponse> {
  const response: AxiosResponse<EventRegistrationListResponse> = await apiClient.get(
    '/registrations',
    { params }
  )
  return response.data
}

/**
 * Get registration details by ID
 */
export async function getRegistration(
  registrationId: string
): Promise<EventRegistrationResponse> {
  const response: AxiosResponse<EventRegistrationResponse> = await apiClient.get(
    `/registrations/${registrationId}`
  )
  return response.data
}

/**
 * Update an existing registration
 */
export async function updateRegistration(
  registrationId: string,
  data: EventRegistrationUpdateRequest
): Promise<EventRegistrationResponse> {
  const response: AxiosResponse<EventRegistrationResponse> = await apiClient.patch(
    `/registrations/${registrationId}`,
    data
  )
  return response.data
}

/**
 * Cancel a registration (soft delete)
 */
export async function cancelRegistration(
  registrationId: string
): Promise<EventRegistrationResponse> {
  const response: AxiosResponse<EventRegistrationResponse> = await apiClient.delete(
    `/registrations/${registrationId}`
  )
  return response.data
}

/**
 * Get events user is registered for with resolved branding.
 *
 * Returns events sorted with upcoming events first (ascending by date),
 * then past events (descending by date). Event branding resolves via
 * fallback chain: event → NPO → system defaults.
 *
 * Use this for the donor PWA event homepage to display a personalized
 * list of events the user is attending.
 */
export async function getRegisteredEventsWithBranding(): Promise<RegisteredEventsResponse> {
  const response: AxiosResponse<RegisteredEventsResponse> = await apiClient.get(
    '/registrations/events-with-branding'
  )
  return response.data
}
