/**
 * Ticket Invitations API Client
 *
 * Provides functions for sending, resending, and validating
 * ticket invitation links, as well as registering via invitation.
 */
import apiClient from '@/lib/axios'

// ================================
// Types
// ================================

export interface InvitationSendResponse {
  invitation_id: string
  assignment_id: string
  email_address: string
  sent_at: string
  invitation_count: number
}

export interface InvitationValidateResponse {
  valid: boolean
  expired: boolean
  already_registered: boolean
  event_name: string | null
  event_date: string | null
  event_slug: string | null
  guest_name: string | null
  guest_email: string | null
  assignment_id: string | null
  /** True when the guest has a pre-created account that needs password setup. */
  needs_account_setup: boolean
  /** One-time setup token used with the setup-and-register endpoint. */
  setup_token: string | null
}

export interface InvitationSetupAndRegisterResponse {
  registration_id: string
  event_id: string
  event_slug: string
  status: string
  access_token: string
  refresh_token: string
}

export interface InvitationRegisterResponse {
  registration_id: string
  event_id: string
  event_slug: string
  status: string
}

// ================================
// API Functions
// ================================

/**
 * Send a ticket invitation email to an assigned guest.
 */
export async function sendInvitation(
  assignmentId: string,
  personalMessage?: string
) {
  const response = await apiClient.post<InvitationSendResponse>(
    `/tickets/assignments/${assignmentId}/invite`,
    { personal_message: personalMessage }
  )
  return response.data
}

/**
 * Resend an invitation email for an assignment.
 */
export async function resendInvitation(assignmentId: string) {
  const response = await apiClient.post<InvitationSendResponse>(
    `/tickets/assignments/${assignmentId}/resend-invite`
  )
  return response.data
}

/**
 * Validate an invitation token to check if it is still valid.
 */
export async function validateInvitationToken(token: string) {
  const response = await apiClient.get<InvitationValidateResponse>(
    `/invitations/${token}/validate`
  )
  return response.data
}

/**
 * Register for an event using an invitation token.
 */
export async function registerViaInvitation(
  token: string,
  data: {
    phone?: string
    meal_selection_id?: string
    custom_responses?: Record<string, string>
  }
) {
  const response = await apiClient.post<InvitationRegisterResponse>(
    `/invitations/${token}/register`,
    data
  )
  return response.data
}

/**
 * Activate a pre-created donor account and complete registration in one step.
 * Used when validate returns needs_account_setup=true.
 */
export async function setupAndRegister(
  token: string,
  data: {
    setup_token: string
    password: string
    phone?: string
    meal_selection_id?: string
    custom_responses?: Record<string, string>
  }
) {
  const response = await apiClient.post<InvitationSetupAndRegisterResponse>(
    `/invitations/${token}/setup-and-register`,
    data
  )
  return response.data
}
