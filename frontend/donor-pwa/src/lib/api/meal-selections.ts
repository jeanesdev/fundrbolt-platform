/**
 * Meal Selection API Client
 *
 * Provides functions for managing meal selections for event attendees.
 */

import apiClient from '@/lib/axios'
import type { AxiosResponse } from 'axios'

// ================================
// Types
// ================================

export interface MealSelectionCreateRequest {
  guest_id?: string | null
  food_option_id: string
}

export interface MealSelectionUpdateRequest {
  food_option_id: string
}

export interface MealSelectionResponse {
  id: string
  registration_id: string
  guest_id: string | null
  food_option_id: string
  created_at: string
  updated_at: string
}

export interface MealSelectionListResponse {
  meal_selections: MealSelectionResponse[]
  total: number
}

// ================================
// API Functions
// ================================

/**
 * Create a meal selection for an attendee
 */
export async function createMealSelection(
  registrationId: string,
  data: MealSelectionCreateRequest
): Promise<MealSelectionResponse> {
  const response: AxiosResponse<MealSelectionResponse> = await apiClient.post(
    `/registrations/${registrationId}/meal-selections`,
    data
  )
  return response.data
}

/**
 * Get all meal selections for a registration
 */
export async function getRegistrationMealSelections(
  registrationId: string
): Promise<MealSelectionListResponse> {
  const response: AxiosResponse<MealSelectionListResponse> = await apiClient.get(
    `/registrations/${registrationId}/meal-selections`
  )
  return response.data
}

/**
 * Update a meal selection
 */
export async function updateMealSelection(
  registrationId: string,
  mealSelectionId: string,
  data: MealSelectionUpdateRequest
): Promise<MealSelectionResponse> {
  const response: AxiosResponse<MealSelectionResponse> = await apiClient.patch(
    `/registrations/${registrationId}/meal-selections/${mealSelectionId}`,
    data
  )
  return response.data
}

/**
 * Delete a meal selection
 */
export async function deleteMealSelection(
  registrationId: string,
  mealSelectionId: string
): Promise<void> {
  await apiClient.delete(
    `/registrations/${registrationId}/meal-selections/${mealSelectionId}`
  )
}
