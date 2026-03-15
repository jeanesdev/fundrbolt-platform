import { cn } from '@/lib/utils'
import { consentService } from '@/services/consent-service'
import { useAuthStore } from '@/stores/auth-store'
import { useState } from 'react'
import { toast } from 'sonner'
import { StepAccount, type AccountData } from './StepAccount'
import { StepDetails } from './StepDetails'
import { StepVerifyEmail } from './StepVerifyEmail'

const STEPS = [
  { id: 'account', label: 'Account' },
  { id: 'details', label: 'Your Info' },
  { id: 'verify', label: 'Verify Email' },
] as const

export function DonorSignUpWizard() {
  const [stepIndex, setStepIndex] = useState(0)
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const register = useAuthStore((state) => state.register)

  const handleAccountNext = (data: AccountData) => {
    setAccountData(data)
    setStepIndex(1)
  }

  const performRegistration = async (extraData: {
    phone?: string
    organization_name?: string
  }) => {
    if (!accountData) return
    setIsRegistering(true)
    setRegisterError(null)
    try {
      await register({
        first_name: accountData.first_name,
        last_name: accountData.last_name,
        email: accountData.email,
        password: accountData.password,
        ...(extraData.phone ? { phone: extraData.phone } : {}),
        ...(extraData.organization_name
          ? { organization_name: extraData.organization_name }
          : {}),
      })

      // Record legal consent (non-fatal)
      if (accountData.legalDocumentIds) {
        try {
          await consentService.acceptConsent({
            tos_document_id: accountData.legalDocumentIds.tosId,
            privacy_document_id: accountData.legalDocumentIds.privacyId,
          })
        } catch {
          // Non-fatal — don't block sign-up if consent recording fails
        }
      }

      setRegisteredEmail(accountData.email)
      toast.success('Account created! Check your email for a verification code.')
      setStepIndex(2)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      const detail =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ||
        (err as { message?: string }).message ||
        'Registration failed. Please try again.'
      if (status === 409 || detail.toLowerCase().includes('already')) {
        setRegisterError(
          'An account with that email already exists. Try signing in instead.'
        )
      } else {
        setRegisterError(detail)
      }
    } finally {
      setIsRegistering(false)
    }
  }

  const handleDetailsNext = (data: {
    phone?: string
    organization_name?: string
  }) => {
    void performRegistration(data)
  }

  const handleDetailsSkip = () => {
    void performRegistration({})
  }

  return (
    <div className='flex w-full flex-col gap-6'>
      {/* Segmented progress bar */}
      <div
        className='flex w-full items-center gap-1'
        role='progressbar'
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
      >
        {STEPS.map((step, idx) => (
          <div key={step.id} className='flex flex-1 flex-col items-center gap-1'>
            <div
              className={cn(
                'h-2 w-full rounded-full transition-colors',
                idx < stepIndex
                  ? 'bg-primary'
                  : idx === stepIndex
                    ? 'bg-primary/60'
                    : 'bg-muted'
              )}
            />
            <span
              className={cn(
                'text-xs',
                idx <= stepIndex ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step content */}
      {stepIndex === 0 && <StepAccount onNext={handleAccountNext} />}

      {stepIndex === 1 && (
        <StepDetails
          isLoading={isRegistering}
          error={registerError}
          onNext={handleDetailsNext}
          onSkip={handleDetailsSkip}
          onBack={() => {
            setRegisterError(null)
            setStepIndex(0)
          }}
        />
      )}

      {stepIndex === 2 && registeredEmail && (
        <StepVerifyEmail email={registeredEmail} />
      )}
    </div>
  )
}
