/**
 * UserSignUpWizard — account creation wizard for a user-only account.
 *
 * Flow: account → verify_email route
 *
 * Reuses the shared SignUpWizard container and StepAccount component. Creates
 * a `user_signup` session on mount for server-side progress tracking.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { createSession, type SessionResponse } from '@/lib/api/onboarding'
import { SignUpWizard, type WizardStep } from '../sign-up-wizard/SignUpWizard'
import { StepAccount } from '../sign-up-wizard/StepAccount'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = 'user_signup_session_token'

const WIZARD_STEPS: WizardStep[] = [{ id: 'account', label: 'Create Account' }]

export function UserSignUpWizard() {
  const navigate = useNavigate()
  const [isInitialising, setIsInitialising] = useState(true)
  const [session, setSession] = useState<SessionResponse | null>(null)

  const initSession = useCallback(async () => {
    setIsInitialising(true)
    try {
      // Try to restore an existing session
      const storedToken = localStorage.getItem(SESSION_TOKEN_KEY)
      if (storedToken) {
        const { getSession } = await import('@/lib/api/onboarding')
        const existing = await getSession(storedToken)
        if (existing) {
          setSession(existing)
          setIsInitialising(false)
          return
        }
      }

      // Create a new user_signup session
      const newSession = await createSession('user_signup')
      localStorage.setItem(SESSION_TOKEN_KEY, newSession.token)
      setSession(newSession)
    } finally {
      setIsInitialising(false)
    }
  }, [])

  useEffect(() => {
    initSession()
  }, [initSession])

  const handleAccountCreated = (email: string) => {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    navigate({ to: '/verify-email', search: { email } })
  }

  if (isInitialising) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  return (
    <SignUpWizard
      steps={WIZARD_STEPS}
      currentStepIndex={0}
      className='max-w-sm'
    >
      {session && (
        <StepAccount
          sessionToken={session.token}
          onNext={handleAccountCreated}
        />
      )}
    </SignUpWizard>
  )
}
