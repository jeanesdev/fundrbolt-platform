/**
 * Onboarding Wizard API Client
 *
 * Public (unauthenticated) endpoints for the NPO onboarding and user sign-up wizard.
 * Uses a raw axios instance configured with the base API URL, without auth interceptors.
 */
import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '')
const apiBaseUrl = normalizedBaseUrl.endsWith('/api/v1')
  ? normalizedBaseUrl
  : normalizedBaseUrl.endsWith('/api')
    ? `${normalizedBaseUrl}/v1`
    : `${normalizedBaseUrl}/api/v1`

/** Axios instance without auth interceptors — for public onboarding endpoints. */
const publicClient = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = 'user_signup' | 'npo_onboarding'

export interface SessionResponse {
  token: string
  session_type: SessionType
  current_step: string
  completed_steps: string[]
  user_id: string | null
  form_data: Record<string, Record<string, unknown>>
  expires_at: string
}

export interface SubmitOnboardingResponse {
  npo_id: string
  application_id: string
  event_id: string | null
  message: string
  duplicate_name_warning: boolean
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Create a new onboarding wizard session.
 * If `authToken` is supplied (authenticated user), the server sets user_id
 * on the session and skips to npo_profile (US2).
 * Rate limited: 20 requests/hour/IP.
 */
export async function createSession(
  sessionType: SessionType,
  authToken?: string
): Promise<SessionResponse> {
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  const response = await publicClient.post<SessionResponse>(
    '/public/onboarding/sessions',
    { session_type: sessionType },
    { headers }
  )
  return response.data
}

/**
 * Retrieve current wizard session state by token.
 * Returns null when the session is not found or expired.
 */
export async function getSession(
  token: string
): Promise<SessionResponse | null> {
  try {
    const response = await publicClient.get<SessionResponse>(
      `/public/onboarding/sessions/${token}`
    )
    return response.data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null
    }
    throw err
  }
}

/**
 * Save wizard step data and advance current_step.
 * Data is merged (not replaced) into the session's form_data for the step.
 */
export async function updateStep(
  token: string,
  stepName: string,
  data: Record<string, unknown>
): Promise<SessionResponse> {
  const response = await publicClient.patch<SessionResponse>(
    `/public/onboarding/sessions/${token}/steps/${stepName}`,
    { data }
  )
  return response.data
}

/**
 * Submit the completed NPO onboarding wizard.
 * Creates the NPO record, application, and optional first event.
 * Requires a Turnstile token. Rate limited: 5 requests/hour/IP.
 */
export async function submitOnboarding(
  sessionToken: string,
  turnstileToken: string
): Promise<SubmitOnboardingResponse> {
  const response = await publicClient.post<SubmitOnboardingResponse>(
    '/public/onboarding/submit',
    { session_token: sessionToken, turnstile_token: turnstileToken }
  )
  return response.data
}
