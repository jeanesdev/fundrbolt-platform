/**
 * Ticket Assignments API Client
 *
 * Provides functions for assigning tickets to guests,
 * updating assignments, and self-registration.
 */
import apiClient from '@/lib/axios'

// ================================
// Types
// ================================

export interface AssignTicketRequest {
  guest_name: string
  guest_email: string
}

export interface AssignTicketResponse {
  id: string
  assigned_ticket_id: string
  guest_name: string
  guest_email: string
  status: string
  is_self_assignment: boolean
  created_at: string
}

export interface SelfRegisterRequest {
  phone?: string | null
  meal_selection_id?: string | null
  custom_responses?: Record<string, string>
}

export interface SelfRegisterResponse {
  registration_id: string
  assignment_id: string
  event_id: string
  status: string
}

// ================================
// API Functions
// ================================

/**
 * Assign a ticket to a guest by name and email.
 */
export async function assignTicket(
  ticketId: string,
  name: string,
  email: string
) {
  const response = await apiClient.post<AssignTicketResponse>(
    `/tickets/${ticketId}/assign`,
    { guest_name: name, guest_email: email }
  )
  return response.data
}

/**
 * Update an existing ticket assignment's guest details.
 */
export async function updateAssignment(
  assignmentId: string,
  name?: string,
  email?: string
) {
  const response = await apiClient.patch<AssignTicketResponse>(
    `/tickets/assignments/${assignmentId}`,
    { guest_name: name, guest_email: email }
  )
  return response.data
}

/**
 * Cancel a ticket assignment, making the ticket available again.
 */
export async function cancelAssignment(assignmentId: string) {
  await apiClient.delete(`/tickets/assignments/${assignmentId}`)
}

/**
 * Self-register for an event using a ticket assignment.
 */
export async function selfRegister(
  assignmentId: string,
  data: SelfRegisterRequest
) {
  const response = await apiClient.post<SelfRegisterResponse>(
    `/tickets/assignments/${assignmentId}/self-register`,
    data
  )
  return response.data
}

/**
 * Cancel an existing registration tied to an assignment.
 */
export async function cancelRegistration(assignmentId: string) {
  await apiClient.post(
    `/tickets/assignments/${assignmentId}/cancel-registration`
  )
}
