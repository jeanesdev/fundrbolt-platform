import { CompleteProfile } from '@/features/auth/complete-profile'
import { useAuthStore } from '@/stores/auth-store'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const PENDING_COMMS_EMAIL_KEY = 'pending_comms_email_verification'

const searchSchema = z.object({
  redirect: z.string().optional(),
  step: z.enum(['otp']).optional(),
  email: z.string().email().optional(),
})

/**
 * Persist OTP deep-link params from the raw browser URL into sessionStorage.
 *
 * Email verification links use standard query strings (e.g.
 * `?step=otp&email=foo`), but TanStack Router's default JSON-based search
 * serializer may not parse them correctly. Reading `window.location.search`
 * directly ensures the params survive the sign-in redirect round-trip.
 */
function persistDeepLinkOtpParams(): void {
  try {
    const raw = new URLSearchParams(window.location.search)
    const step = raw.get('step')
    const email = raw.get('email')
    if (step === 'otp' && email) {
      sessionStorage.setItem(PENDING_COMMS_EMAIL_KEY, email)
    }
  } catch {
    // Ignore — private browsing may block sessionStorage
  }
}

export const Route = createFileRoute('/(auth)/complete-profile')({
  validateSearch: searchSchema,
  beforeLoad: ({ location }) => {
    // Always persist deep-link OTP params before any redirect so the
    // CompleteProfile component can restore them from sessionStorage.
    persistDeepLinkOtpParams()

    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: CompleteProfile,
})
