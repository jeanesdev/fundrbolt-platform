/**
 * Registration Guest API Client
 *
 * Provides functions for managing guest information for event registrations.
 */

import apiClient from '@/lib/axios'
import type { AxiosResponse } from 'axios'

// ================================
// Types
// ================================

export interface RegistrationGuestCreateRequest {
  registration_id: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

export interface RegistrationGuestUpdateRequest {
  name?: string | null
  email?: string | null
  phone?: string | null
}

export interface RegistrationGuestResponse {
  id: string
  registration_id: string
  user_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  invited_by_admin: boolean
  invitation_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface RegistrationGuestListResponse {
  guests: RegistrationGuestResponse[]
  total: number
}

// ================================
// API Functions
// ================================

/**
 * Add a guest to a registration
 */
export async function addGuest(
  registrationId: string,
  data: Omit<RegistrationGuestCreateRequest, 'registration_id'>
): Promise<RegistrationGuestResponse> {
  const response: AxiosResponse<RegistrationGuestResponse> = await apiClient.post(
    `/registrations/${registrationId}/guests`,
    data
  )
  return response.data
}

/**
 * Get all guests for a registration
 */
export async function getRegistrationGuests(
  registrationId: string
): Promise<RegistrationGuestListResponse> {
  const response: AxiosResponse<RegistrationGuestListResponse> = await apiClient.get(
    `/registrations/${registrationId}/guests`
  )
  return response.data
}

/**
 * Update guest information
 */
export async function updateGuest(
  registrationId: string,
  guestId: string,
  data: RegistrationGuestUpdateRequest
): Promise<RegistrationGuestResponse> {
  const response: AxiosResponse<RegistrationGuestResponse> = await apiClient.patch(
    `/registrations/${registrationId}/guests/${guestId}`,
    data
  )
  return response.data
}

/**
 * Delete a guest from a registration
 */
export async function deleteGuest(
  registrationId: string,
  guestId: string
): Promise<void> {
  await apiClient.delete(`/registrations/${registrationId}/guests/${guestId}`)
}
