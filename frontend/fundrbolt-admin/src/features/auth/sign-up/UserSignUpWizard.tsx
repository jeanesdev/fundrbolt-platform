/**
 * UserSignUpWizard — two-step wizard for creating a user-only account.
 *
 * Flow:  account → verify_email → dashboard
 *
 * Reuses the shared SignUpWizard container and StepAccount / StepVerifyEmail
 * components. Creates a `user_signup` session on mount for server-side
 * progress tracking.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { createSession, type SessionResponse } from '@/lib/api/onboarding'
import { SignUpWizard, type WizardStep } from '../sign-up-wizard/SignUpWizard'
import { StepAccount } from '../sign-up-wizard/StepAccount'
import { StepVerifyEmail } from '../sign-up-wizard/StepVerifyEmail'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = 'user_signup_session_token'

const WIZARD_STEPS: WizardStep[] = [
  { id: 'account', label: 'Create Account' },
  { id: 'verify_email', label: 'Verify Email' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type StepId = 'account' | 'verify_email'

export function UserSignUpWizard() {
  const navigate = useNavigate()
  const [isInitialising, setIsInitialising] = useState(true)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [currentStep, setCurrentStep] = useState<StepId>('account')
  const [userEmail, setUserEmail] = useState('')

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  const currentStepIdx = stepIndex >= 0 ? stepIndex : 0

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
          setCurrentStep(existing.current_step as StepId)
          const email = existing.form_data?.account?.email as string | undefined
          if (email) setUserEmail(email)
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
    setUserEmail(email)
    setCurrentStep('verify_email')
  }

  const handleEmailVerified = () => {
    localStorage.removeItem(SESSION_TOKEN_KEY)
    navigate({ to: '/' })
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
      currentStepIndex={currentStepIdx}
      className='max-w-sm'
    >
      {currentStep === 'account' && session && (
        <StepAccount
          sessionToken={session.token}
          onNext={() => {
            const values = session.form_data?.account
            if (values?.email) handleAccountCreated(values.email as string)
            else setCurrentStep('verify_email')
          }}
        />
      )}

      {currentStep === 'verify_email' && (
        <StepVerifyEmail email={userEmail} onNext={handleEmailVerified} />
      )}
    </SignUpWizard>
  )
}
