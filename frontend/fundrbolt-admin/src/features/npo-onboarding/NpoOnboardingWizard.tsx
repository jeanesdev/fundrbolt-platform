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
import { ProfileDropdown } from '@/components/profile-dropdown'
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
import apiClient from '@/lib/axios'
import { npoApi } from '@/services/npo-service'
import { useAuthStore } from '@/stores/auth-store'
import LogoWhiteGold from '@fundrbolt/shared/assets/logos/fundrbolt-logo-white-gold.svg'
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
import { StepFirstEvent, type FirstEventFormValues } from './StepFirstEvent'
import { StepNpoProfile } from './StepNpoProfile'
import { TurnstileWidget, type TurnstileWidgetHandle } from './TurnstileWidget'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = 'onboarding_session_token'
const NO_PENDING_SUBMISSION = Symbol('no-pending-submission')

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
  const pendingSubmissionRef = useRef<
    FirstEventFormValues | null | typeof NO_PENDING_SUBMISSION
  >(NO_PENDING_SUBMISSION)
  /** Prevents initSession from running again after successful submission. */
  const submittedRef = useRef(false)

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
    // Don't re-initialize once submission has completed
    if (submittedRef.current) return

    setIsInitialising(true)
    setInitError(null)

    try {
      const storedToken = localStorage.getItem(SESSION_TOKEN_KEY)
      const shouldUpgradeAnonymousSession = Boolean(
        isAuthenticated && accessToken
      )

      if (storedToken) {
        const existing = await getSession(storedToken)
        if (existing) {
          if (shouldUpgradeAnonymousSession && !existing.user_id) {
            localStorage.removeItem(SESSION_TOKEN_KEY)
          } else {
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
  const finalizeSubmission = useCallback(
    async (
      turnstileToken: string,
      firstEventValues: FirstEventFormValues | null
    ) => {
      if (!session) return

      pendingSubmissionRef.current = NO_PENDING_SUBMISSION
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        await submitOnboarding(session.token, turnstileToken, firstEventValues)

        // Block any subsequent initSession re-runs (e.g. triggered by setUser below)
        submittedRef.current = true

        // Advance immediately after a successful submit. Role refresh is helpful,
        // but it should not keep the user on a loading state.
        localStorage.removeItem(SESSION_TOKEN_KEY)
        setCurrentStep('confirmation')

        // Refresh the auth store so the new npo_admin role is reflected
        // (backend upgrades the user from donor → npo_admin on submission)
        void (async () => {
          try {
            const { data: freshUser } = await apiClient.get('/users/me', {
              timeout: 5000,
            })
            useAuthStore.getState().setUser(freshUser)
          } catch {
            // Non-fatal — user can re-login to pick up the new role
          }
        })()
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
    },
    [session]
  )

  const handleSubmit = useCallback(
    async (firstEventValues: FirstEventFormValues | null) => {
      if (!session) return

      const token = captchaToken
      if (!token) {
        pendingSubmissionRef.current = firstEventValues
        turnstileRef.current?.execute()
        toast.error('Verifying security, please hold.')
        return
      }

      await finalizeSubmission(token, firstEventValues)
    },
    [session, captchaToken, finalizeSubmission]
  )

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
    <div className='mx-auto w-full max-w-4xl px-4 py-6 sm:py-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <img src={LogoWhiteGold} alt='FundrBolt' className='h-10 sm:h-12' />
        {isAuthenticated && <ProfileDropdown />}
      </div>

      <div className='mx-auto w-full max-w-lg space-y-6'>
        {/* Invisible Turnstile for submit-time CAPTCHA */}
        <TurnstileWidget
          ref={turnstileRef}
          onVerify={(token) => {
            setCaptchaToken(token)

            if (pendingSubmissionRef.current !== NO_PENDING_SUBMISSION) {
              const pendingSubmission = pendingSubmissionRef.current
              void finalizeSubmission(token, pendingSubmission)
            }
          }}
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
              onNext={(email) => {
                setWizardData((prev) => ({ ...prev, email }))
                goToStep('verify_email')
              }}
            />
          )}

          {/* ---- verify_email ---- */}
          {currentStep === 'verify_email' && (
            <StepVerifyEmail
              email={wizardData.email ?? ''}
              onNext={() => goToStep('npo_profile')}
              sessionToken={session?.token}
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
                setWizardData((prev) => ({
                  ...prev,
                  npoName: values.npo_name,
                }))
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
                onNext={async (values) => {
                  await handleSubmit(values)
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
    </div>
  )
}
