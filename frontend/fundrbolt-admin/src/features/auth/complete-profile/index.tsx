/**
 * CompleteProfile — first-time profile completion wizard.
 *
 * Shown once after a user's first login. Prompts for key profile
 * information (photo, organization, phone, social links) using the
 * same SignUpWizard container as the sign-up flow.
 *
 * Detection: localStorage flag `profile_setup_seen_<userId>` is
 * absent on first login; set when user completes or skips the prompt.
 */
import { ProfilePictureUpload } from '@/components/profile/profile-picture-upload'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/features/auth/auth-layout'
import {
  SignUpWizard,
  type WizardStep,
} from '@/features/auth/sign-up-wizard/SignUpWizard'
import { PasswordChangeForm } from '@/features/settings/account/components/password-change-form'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { markProfileSetupSeen } from './utils'

// ---------------------------------------------------------------------------
// Storage helpers for pending comms email OTP
// ---------------------------------------------------------------------------

const PENDING_COMMS_EMAIL_KEY = 'admin_pending_comms_email_verification'

function getPendingCommsEmail(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_COMMS_EMAIL_KEY)
  } catch {
    return null
  }
}

function setPendingCommsEmail(email: string): void {
  try {
    window.sessionStorage.setItem(PENDING_COMMS_EMAIL_KEY, email)
  } catch {
    // ignore
  }
}

function clearPendingCommsEmail(): void {
  try {
    window.sessionStorage.removeItem(PENDING_COMMS_EMAIL_KEY)
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const phoneRegex = /^\+[1-9]\d{1,14}$/

const completeProfileSchema = z.object({
  organization_name: z.string().max(255).trim().optional(),

  phone: z
    .string()
    .refine(
      (val) => !val || phoneRegex.test(val),
      'Phone must be a valid number (e.g., +14155552671)'
    )
    .optional(),

  linkedin: z
    .string()
    .regex(/^([a-zA-Z0-9\-_.]+)?$/, 'Enter only your LinkedIn username')
    .optional(),

  twitter: z
    .string()
    .regex(/^([A-Za-z0-9_]+)?$/, 'Enter only your Twitter/X handle')
    .optional(),

  website: z
    .string()
    .regex(
      /^(|[a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,})$/,
      'Enter only your website domain (e.g., yourorg.com)'
    )
    .optional(),
})

type CompleteProfileFormData = z.infer<typeof completeProfileSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIZARD_STEPS: WizardStep[] = [{ id: 'profile', label: 'Your Profile' }]

// ---------------------------------------------------------------------------
// Communications email sub-component
// ---------------------------------------------------------------------------

type CommsEmailState =
  | { step: 'idle'; verifiedEmail: string | null }
  | { step: 'entering'; email: string }
  | { step: 'otp'; email: string }
  | { step: 'verified'; email: string }

export function CommunicationsEmailSection({
  onVerified,
}: {
  onVerified?: () => void
}) {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  const initialVerified =
    user?.communications_email_verified && user.communications_email
      ? user.communications_email
      : null
  const restoredPendingEmail = getPendingCommsEmail()

  const [state, setState] = useState<CommsEmailState>(
    initialVerified
      ? { step: 'verified', email: initialVerified }
      : restoredPendingEmail
        ? { step: 'otp', email: restoredPendingEmail }
        : { step: 'idle', verifiedEmail: null }
  )
  const [inputEmail, setInputEmail] = useState(
    restoredPendingEmail || user?.communications_email || user?.email || ''
  )
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')

  const requestMutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.post('/users/me/communications-email/request-verification', {
        email,
      }),
    onSuccess: (_response, email) => {
      setPendingCommsEmail(email)
      setState({ step: 'otp', email })
      setInputEmail(email)
      toast.success(`Verification code sent to ${email}`)
    },
    onError: () =>
      toast.error('Failed to send verification code. Please try again.'),
  })

  const confirmMutation = useMutation({
    mutationFn: (code: string) =>
      apiClient.post('/users/me/communications-email/confirm', { otp: code }),
    onSuccess: () => {
      if (state.step === 'otp') {
        clearPendingCommsEmail()
        setState({ step: 'verified', email: state.email })
        setUser(
          user
            ? {
              ...user,
              communications_email: state.email,
              communications_email_verified: true,
            }
            : null
        )
        toast.success('Communications email verified!')
        onVerified?.()
      }
    },
    onError: () => {
      setOtpError('That code is incorrect or has expired. Try again.')
    },
  })

  if (state.step === 'verified') {
    return (
      <div className='space-y-1.5'>
        <label className='text-sm font-medium'>Email</label>
        <div className='flex items-center gap-2'>
          <Input
            value={state.email}
            readOnly
            disabled
            className='bg-muted text-muted-foreground'
          />
          <CheckCircle2 className='h-5 w-5 shrink-0 text-green-600' />
        </div>
        <button
          type='button'
          className='text-primary text-xs underline'
          onClick={() => {
            clearPendingCommsEmail()
            setState({ step: 'entering', email: state.email })
            setInputEmail(state.email)
            setOtp('')
            setOtpError('')
          }}
        >
          Change
        </button>
      </div>
    )
  }

  if (state.step === 'otp') {
    return (
      <div className='space-y-1.5'>
        <label className='text-sm font-medium'>Enter verification code</label>
        <p className='text-muted-foreground text-xs'>
          We sent a 6-digit code to <strong>{state.email}</strong>.
        </p>
        <div className='flex gap-2'>
          <Input
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              setOtpError('')
            }}
            placeholder='123456'
            inputMode='numeric'
            maxLength={6}
            className='w-36'
          />
          <Button
            type='button'
            size='sm'
            disabled={otp.length !== 6 || confirmMutation.isPending}
            onClick={() => confirmMutation.mutate(otp)}
          >
            {confirmMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              'Verify'
            )}
          </Button>
        </div>
        {otpError && <p className='text-destructive text-xs'>{otpError}</p>}
        <p className='text-muted-foreground text-xs'>
          You can enter the code here now, or come back later from the link in
          the email.
        </p>
        <button
          type='button'
          className='text-primary text-xs underline'
          onClick={() => {
            setPendingCommsEmail(state.email)
            requestMutation.mutate(state.email)
          }}
          disabled={requestMutation.isPending}
        >
          Resend code
        </button>
      </div>
    )
  }

  // idle or entering
  return (
    <div className='space-y-1.5'>
      <label className='text-sm font-medium'>Email</label>
      <div className='flex gap-2'>
        <Input
          type='email'
          inputMode='email'
          placeholder='personal@example.com'
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
        />
        <Button
          type='button'
          size='sm'
          disabled={!inputEmail || requestMutation.isPending}
          onClick={() => requestMutation.mutate(inputEmail)}
        >
          {requestMutation.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            'Send code'
          )}
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>
        Where we'll send event notifications and updates.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompleteProfile() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/complete-profile' })
  const redirectTo = (search as { redirect?: string }).redirect ?? '/'
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const [pictureUploaded, setPictureUploaded] = useState(false)

  // Start at step 2 if email already verified
  const alreadyVerified =
    !!user?.communications_email_verified && !!user?.communications_email
  const [profileStep, setProfileStep] = useState<'email' | 'profile'>(
    alreadyVerified ? 'profile' : 'email'
  )

  // Mark as seen on mount — navigating away (e.g. browser back) without
  // clicking Skip should still prevent future redirects to this page.
  useEffect(() => {
    if (user) markProfileSetupSeen(user.id)
  }, [user])

  const form = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      organization_name: '',
      phone: '',
      linkedin: '',
      twitter: '',
      website: '',
    },
    mode: 'onBlur',
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data: CompleteProfileFormData) => {
      const socialLinks: Record<string, string> = {}
      if (data.linkedin)
        socialLinks['linkedin'] = `https://linkedin.com/in/${data.linkedin}`
      if (data.twitter) socialLinks['twitter'] = `https://x.com/${data.twitter}`
      if (data.website)
        socialLinks['website'] = data.website.includes('://')
          ? data.website
          : `https://${data.website}`

      const payload: Record<string, unknown> = {
        first_name: user?.first_name ?? '',
        last_name: user?.last_name ?? '',
      }
      if (data.organization_name)
        payload['organization_name'] = data.organization_name
      if (data.phone) payload['phone'] = data.phone
      if (Object.keys(socialLinks).length > 0) {
        payload['social_media_links'] = socialLinks
      }

      const response = await apiClient.patch('/users/me/profile', payload)
      return response.data
    },
    onSuccess: (data) => {
      setUser(data.user ?? data)
      if (user) markProfileSetupSeen(user.id)
      toast.success('Profile saved!')
      navigate({ to: redirectTo })
    },
    onError: () => {
      toast.error('Failed to save profile. Please try again.')
    },
  })

  const onSubmit = (data: CompleteProfileFormData) => {
    updateProfileMutation.mutate(data)
  }

  const handleSkipEmailStep = () => {
    setProfileStep('profile')
  }

  const handleSkip = () => {
    if (user) markProfileSetupSeen(user.id)
    navigate({ to: redirectTo })
  }

  if (!user) return null

  const userInitials =
    `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()

  // ── Step 1: verify communications email ──────────────────────────────────
  if (profileStep === 'email' && !alreadyVerified) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              Where should we send updates?
            </CardTitle>
            <CardDescription>
              Enter and verify the email address where you'd like to receive
              notifications and updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <CommunicationsEmailSection
                onVerified={() => setProfileStep('profile')}
              />
              <Button
                type='button'
                variant='ghost'
                className='w-full'
                onClick={handleSkipEmailStep}
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  // ── Step 2: profile details ───────────────────────────────────────────────
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Complete your profile
          </CardTitle>
          <CardDescription>
            Help others recognise you and make the most of FundrBolt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpWizard steps={WIZARD_STEPS} currentStepIndex={0}>
            <div className='space-y-6'>
              {/* Profile picture */}
              <div className='flex flex-col items-center gap-2'>
                <ProfilePictureUpload
                  userId={user.id}
                  currentPictureUrl={user.profile_picture_url}
                  userInitials={userInitials}
                  onUploadComplete={() => setPictureUploaded(true)}
                />
                {pictureUploaded && (
                  <p className='text-muted-foreground text-xs'>
                    Profile photo saved
                  </p>
                )}
              </div>

              {/* Profile fields */}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className='space-y-4'
                >
                  {/* Organization name */}
                  <FormField
                    control={form.control}
                    name='organization_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization / Company</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Acme Nonprofit Inc.'
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone */}
                  <FormField
                    control={form.control}
                    name='phone'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cell Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder='(555) 555-5555'
                            {...field}
                            value={
                              field.value ? formatPhoneNumber(field.value) : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '')
                              if (!raw) {
                                field.onChange('')
                              } else if (raw.length === 10) {
                                field.onChange(`+1${raw}`)
                              } else if (
                                raw.startsWith('1') &&
                                raw.length === 11
                              ) {
                                field.onChange(`+${raw}`)
                              } else {
                                field.onChange(`+${raw}`)
                              }
                            }}
                            inputMode='tel'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Social links */}
                  <div className='space-y-3'>
                    <p className='text-sm font-medium'>Social profiles</p>

                    <FormField
                      control={form.control}
                      name='linkedin'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            LinkedIn
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='yourname'
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='twitter'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            X / Twitter
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='yourhandle'
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name='website'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='yourorg.com'
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <PasswordChangeForm
                    collapsible
                    defaultOpen={false}
                    title='Recovery Password'
                    description='Optional. Save a password as an alternate login in addition to OAuth.'
                  />

                  {/* Actions */}
                  <div className='flex flex-col gap-3 pt-2'>
                    <Button
                      type='submit'
                      className='w-full'
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Saving…
                        </>
                      ) : (
                        'Save & continue'
                      )}
                    </Button>

                    <Button
                      type='button'
                      variant='ghost'
                      className='text-muted-foreground w-full text-sm'
                      onClick={handleSkip}
                      disabled={updateProfileMutation.isPending}
                    >
                      Skip for now
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </SignUpWizard>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
