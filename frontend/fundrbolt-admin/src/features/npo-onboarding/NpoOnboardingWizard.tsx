/**
 * NpoOnboardingWizard — top-level orchestrator for the NPO onboarding flow.
 *
 * Session lifecycle:
 *  - On mount, reads localStorage for a persisted session token.
 *  - If a valid session exists, the wizard resumes from `current_step`.
 *  - Otherwise a new session is created and the token stored.
 *
 * Step flow (unauthenticated):
 *   account → verify_email → npo_profile → first_event → [SUBMIT] → confirmation
 *
 * Step flow (authenticated, US2 — Phase 4):
 *   npo_profile → first_event → [SUBMIT] → confirmation
 *
 * The Turnstile CAPTCHA token is collected silently during the npo_profile
 * and first_event steps and used at submission time.
 */
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  createSession,
  getSession,
  submitOnboarding,
  type SessionResponse,
} from '@/lib/api/onboarding'
import { npoApi } from '@/services/npo-service'
import { useAuthStore } from '@/stores/auth-store'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  SignUpWizard,
  type WizardStep,
} from '../auth/sign-up-wizard/SignUpWizard'
import { StepAccount } from '../auth/sign-up-wizard/StepAccount'
import { StepVerifyEmail } from '../auth/sign-up-wizard/StepVerifyEmail'
import { StepConfirmation } from './StepConfirmation'
import { StepFirstEvent } from './StepFirstEvent'
import { StepNpoProfile } from './StepNpoProfile'
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = 'onboarding_session_token'

// All possible wizard steps in order
const ALL_WIZARD_STEPS: WizardStep[] = [
  { id: 'account', label: 'Account' },
  { id: 'verify_email', label: 'Verify Email' },
  { id: 'npo_profile', label: 'Organization' },
  { id: 'first_event', label: 'First Event' },
  { id: 'confirmation', label: 'Confirmation' },
]

// Steps for authenticated users (account + verify already done)
const AUTH_WIZARD_STEPS: WizardStep[] = ALL_WIZARD_STEPS.filter(
  (s) => s.id !== 'account' && s.id !== 'verify_email'
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStepId =
  | 'account'
  | 'verify_email'
  | 'npo_profile'
  | 'first_event'
  | 'confirmation'

interface WizardData {
  email?: string
  firstName?: string
  npoName?: string
}

/** Pre-fill values for StepNpoProfile in revision mode */
interface NpoProfilePrefill {
  npo_name?: string
  ein?: string
  website_url?: string
  phone?: string
  mission?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NpoOnboardingWizard() {
  const { isAuthenticated, user, accessToken } = useAuthStore()

  const [isInitialising, setIsInitialising] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [currentStep, setCurrentStep] = useState<WizardStepId>('account')
  const [wizardData, setWizardData] = useState<WizardData>({})
  const [isRevisionMode, setIsRevisionMode] = useState(false)
  const [revisionNpoPrefill, setRevisionNpoPrefill] =
    useState<NpoProfilePrefill | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const turnstileRef = useRef<TurnstileWidgetHandle>(null)

  // -------------------------------------------------------------------
  // Resolve which progress steps to show
  // -------------------------------------------------------------------
  const visibleSteps = isAuthenticated ? AUTH_WIZARD_STEPS : ALL_WIZARD_STEPS
  const stepIndex = visibleSteps.findIndex((s) => s.id === currentStep)
  const currentStepIdx = stepIndex >= 0 ? stepIndex : 0

  // -------------------------------------------------------------------
  // Session initialisation
  // -------------------------------------------------------------------
  const initSession = useCallback(async () => {
    setIsInitialising(true)
    setInitError(null)

    try {
      const storedToken = localStorage.getItem(SESSION_TOKEN_KEY)

      if (storedToken) {
        const existing = await getSession(storedToken)
        if (existing) {
          setSession(existing)
          setCurrentStep(existing.current_step as WizardStepId)

          // Pre-fill wizard data from stored session
          const fd = existing.form_data
          setWizardData({
            email: (fd.account?.email as string) ?? '',
            firstName: (fd.account?.first_name as string) ?? user?.first_name,
            npoName: (fd.npo_profile?.npo_name as string) ?? '',
          })
          setIsInitialising(false)
          return
        }
      }

      // No valid session — create a new one, passing auth token for US2 skip-ahead
      const newSession = await createSession(
        'npo_onboarding',
        isAuthenticated && accessToken ? accessToken : undefined
      )
      localStorage.setItem(SESSION_TOKEN_KEY, newSession.token)
      setSession(newSession)

      // Authenticated users skip account + verify steps
      const startStep = isAuthenticated
        ? ('npo_profile' as WizardStepId)
        : (newSession.current_step as WizardStepId)

      setCurrentStep(startStep)

      if (isAuthenticated && user) {
        setWizardData({ firstName: user.first_name })

        // T044b — Check if user has an NPO under revision (resubmission flow)
        try {
          const npoList = await npoApi.listNPOs({ status: 'under_revision' })
          const underRevisionNpo = npoList.items[0]
          if (underRevisionNpo) {
            setIsRevisionMode(true)
            setRevisionNpoPrefill({
              npo_name: underRevisionNpo.name ?? '',
              ein: underRevisionNpo.tax_id ?? '',
              website_url: underRevisionNpo.website_url ?? '',
              phone: underRevisionNpo.phone ?? '',
              mission: underRevisionNpo.mission_statement ?? '',
            })
            setWizardData({
              firstName: user.first_name,
              npoName: underRevisionNpo.name ?? '',
            })
          }
        } catch {
          // Non-fatal: revision mode detection failed — proceed as normal new application
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? 'Failed to initialise wizard. Please refresh the page.'
      setInitError(msg)
    } finally {
      setIsInitialising(false)
    }
  }, [isAuthenticated, user, accessToken])

  useEffect(() => {
    initSession()
  }, [initSession])

  // -------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!session) return

    // Ensure we have a CAPTCHA token
    const token = captchaToken
    if (!token) {
      turnstileRef.current?.execute()
      toast.error('Security check in progress. Please try again in a moment.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await submitOnboarding(session.token, token)

      // Clear persisted session token on success
      localStorage.removeItem(SESSION_TOKEN_KEY)

      setCurrentStep('confirmation')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ??
        (err as { message?: string }).message ??
        'Submission failed. Please try again.'
      setSubmitError(detail)
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setIsSubmitting(false)
    }
  }, [session, captchaToken])

  // -------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------
  const goToStep = (step: WizardStepId) => setCurrentStep(step)

  // -------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------
  if (isInitialising) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
      </div>
    )
  }

  if (initError) {
    return (
      <div className='space-y-4'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{initError}</AlertDescription>
        </Alert>
        <Button className='w-full' onClick={initSession}>
          Try again
        </Button>
      </div>
    )
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className='mx-auto w-full max-w-lg space-y-6 px-4 py-8'>
      {/* Invisible Turnstile for submit-time CAPTCHA */}
      <TurnstileWidget
        ref={turnstileRef}
        onVerify={(t) => setCaptchaToken(t)}
        onExpire={() => setCaptchaToken(null)}
      />

      {/* Progress wizard shell */}
      <SignUpWizard
        steps={visibleSteps}
        currentStepIndex={currentStepIdx}
        headingBadge={
          isRevisionMode ? (
            <Badge variant='secondary'>Revision Mode</Badge>
          ) : undefined
        }
      >
        {/* ---- account ---- */}
        {currentStep === 'account' && session && (
          <StepAccount
            sessionToken={session.token}
            onNext={() => {
              goToStep('verify_email')
            }}
          />
        )}

        {/* ---- verify_email ---- */}
        {currentStep === 'verify_email' && (
          <StepVerifyEmail
            email={wizardData.email ?? ''}
            onNext={() => goToStep('npo_profile')}
          />
        )}

        {/* ---- npo_profile ---- */}
        {currentStep === 'npo_profile' && session && (
          <StepNpoProfile
            sessionToken={session.token}
            initialValues={
              revisionNpoPrefill ?? { npo_name: wizardData.npoName }
            }
            onNext={(values) => {
              setWizardData((prev) => ({ ...prev, npoName: values.npo_name }))
              goToStep('first_event')
            }}
            onBack={
              isAuthenticated ? undefined : () => goToStep('verify_email')
            }
          />
        )}

        {/* ---- first_event ---- */}
        {currentStep === 'first_event' && session && (
          <>
            {submitError && (
              <Alert variant='destructive' className='mb-4'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
            <StepFirstEvent
              sessionToken={session.token}
              onNext={async (_values) => {
                await handleSubmit()
              }}
              onBack={() => goToStep('npo_profile')}
            />
            {isSubmitting && (
              <div className='flex items-center justify-center py-4'>
                <Loader2 className='text-primary mr-2 h-5 w-5 animate-spin' />
                <span className='text-muted-foreground text-sm'>
                  Submitting your application…
                </span>
              </div>
            )}
          </>
        )}

        {/* ---- confirmation ---- */}
        {currentStep === 'confirmation' && (
          <StepConfirmation
            firstName={wizardData.firstName ?? user?.first_name ?? 'there'}
            npoName={wizardData.npoName ?? ''}
          />
        )}
      </SignUpWizard>

      {/* Session expiry helper */}
      <Card className='border-dashed'>
        <CardContent className='text-muted-foreground py-3 text-center text-xs'>
          Your progress is saved for 24 hours. You can close this window and
          return on the same device to continue.
        </CardContent>
      </Card>
    </div>
  )
}
