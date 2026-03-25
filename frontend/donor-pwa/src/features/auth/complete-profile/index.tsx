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
// Schema
// ---------------------------------------------------------------------------

const phoneRegex = /^\+[1-9]\d{1,14}$/

const completeProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  organization_name: z
    .string()
    .max(255, 'Company must be 255 characters or less')
    .optional(),
  address_line1: z
    .string()
    .max(255, 'Address line 1 must be 255 characters or less')
    .optional(),
  address_line2: z
    .string()
    .max(255, 'Address line 2 must be 255 characters or less')
    .optional(),
  city: z.string().max(100, 'City must be 100 characters or less').optional(),
  state: z.string().max(100, 'State must be 100 characters or less').optional(),
  postal_code: z
    .string()
    .max(20, 'Postal code must be 20 characters or less')
    .optional(),
  country: z
    .string()
    .max(100, 'Country must be 100 characters or less')
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
      'Enter only your website domain (e.g., yoursite.com)'
    )
    .optional(),

  phone: z
    .string()
    .refine(
      (val) => !val || phoneRegex.test(val),
      'Phone must be a valid number (e.g., +14155552671)'
    )
    .optional(),
})

type FormValues = z.infer<typeof completeProfileSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Communications email sub-component
// ---------------------------------------------------------------------------

type CommsEmailState =
  | { step: 'idle'; verifiedEmail: string | null }
  | { step: 'entering'; email: string }
  | { step: 'otp'; email: string }
  | { step: 'verified'; email: string }

function CommunicationsEmailSection({
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

  const [state, setState] = useState<CommsEmailState>(
    initialVerified
      ? { step: 'verified', email: initialVerified }
      : { step: 'idle', verifiedEmail: null }
  )
  const [inputEmail, setInputEmail] = useState(
    user?.communications_email || user?.email || ''
  )
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')

  const requestMutation = useMutation({
    mutationFn: (email: string) =>
      apiClient.post('/users/me/communications-email/request-verification', {
        email,
      }),
    onSuccess: () => {
      setState({ step: 'otp', email: inputEmail })
      toast.success(`Verification code sent to ${inputEmail}`)
    },
    onError: () =>
      toast.error('Failed to send verification code. Please try again.'),
  })

  const confirmMutation = useMutation({
    mutationFn: (code: string) =>
      apiClient.post('/users/me/communications-email/confirm', { otp: code }),
    onSuccess: () => {
      if (state.step === 'otp') {
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
            setState({ step: 'entering', email: state.email })
            setInputEmail(state.email)
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
        <button
          type='button'
          className='text-primary text-xs underline'
          onClick={() => requestMutation.mutate(state.email)}
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
  const redirectTo = (search as { redirect?: string }).redirect ?? '/home'
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const isLoading = useAuthStore((state) => state.isLoading)
  const restoreUserFromRefreshToken = useAuthStore(
    (state) => state.restoreUserFromRefreshToken
  )
  const [pictureUploaded, setPictureUploaded] = useState(false)

  // Load user data if arriving from social auth (tokens set but user not yet fetched)
  useEffect(() => {
    if (!user && !isLoading) {
      restoreUserFromRefreshToken()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start at step 2 if email already verified
  const alreadyVerified =
    !!user?.communications_email_verified && !!user?.communications_email
  const [profileStep, setProfileStep] = useState<'email' | 'profile'>(
    alreadyVerified ? 'profile' : 'email'
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      organization_name: user?.organization_name ?? '',
      address_line1: user?.address_line1 ?? '',
      address_line2: user?.address_line2 ?? '',
      city: user?.city ?? '',
      state: user?.state ?? '',
      postal_code: user?.postal_code ?? '',
      country: user?.country ?? '',
      linkedin:
        user?.social_media_links?.linkedin?.replace(
          /^https?:\/\/linkedin\.com\/in\//,
          ''
        ) ?? '',
      twitter:
        user?.social_media_links?.twitter?.replace(
          /^https?:\/\/x\.com\//,
          ''
        ) ?? '',
      website:
        user?.social_media_links?.website?.replace(/^https?:\/\//, '') ?? '',
      phone: user?.phone ?? '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (!user) return

    form.reset({
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      organization_name: user.organization_name ?? '',
      address_line1: user.address_line1 ?? '',
      address_line2: user.address_line2 ?? '',
      city: user.city ?? '',
      state: user.state ?? '',
      postal_code: user.postal_code ?? '',
      country: user.country ?? '',
      linkedin:
        user.social_media_links?.linkedin?.replace(
          /^https?:\/\/linkedin\.com\/in\//,
          ''
        ) ?? '',
      twitter:
        user.social_media_links?.twitter?.replace(/^https?:\/\/x\.com\//, '') ??
        '',
      website:
        user.social_media_links?.website?.replace(/^https?:\/\//, '') ?? '',
      phone: user.phone ?? '',
    })
  }, [form, user])

  const updateProfileMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const socialLinks: Record<string, string> = {}
      if (data.linkedin)
        socialLinks['linkedin'] = `https://linkedin.com/in/${data.linkedin}`
      if (data.twitter) socialLinks['twitter'] = `https://x.com/${data.twitter}`
      if (data.website)
        socialLinks['website'] = data.website.includes('://')
          ? data.website
          : `https://${data.website}`

      const payload: Record<string, unknown> = {
        first_name: data.first_name,
        last_name: data.last_name,
      }
      if (data.phone) payload['phone'] = data.phone
      if (data.organization_name !== undefined) {
        payload['organization_name'] = data.organization_name || ''
      }
      if (data.address_line1 !== undefined) {
        payload['address_line1'] = data.address_line1 || ''
      }
      if (data.address_line2 !== undefined) {
        payload['address_line2'] = data.address_line2 || ''
      }
      if (data.city !== undefined) payload['city'] = data.city || ''
      if (data.state !== undefined) payload['state'] = data.state || ''
      if (data.postal_code !== undefined) {
        payload['postal_code'] = data.postal_code || ''
      }
      if (data.country !== undefined) payload['country'] = data.country || ''
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
      navigate({ to: redirectTo as string })
    },
    onError: () => {
      toast.error('Failed to save profile. Please try again.')
    },
  })

  const handleSkip = () => {
    if (user) markProfileSetupSeen(user.id)
    navigate({ to: redirectTo as string })
  }

  if (!user) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardContent className='flex flex-col items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin' />
            <p className='text-muted-foreground mt-4 text-sm'>
              Loading your profile...
            </p>
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  const userInitials =
    `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()

  // ── Step 1: verify communications email ──────────────────────────────────
  if (profileStep === 'email') {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              Where should we send updates?
            </CardTitle>
            <CardDescription>
              Enter and verify the email address where you'd like to receive
              event notifications and updates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <CommunicationsEmailSection
                onVerified={() => setProfileStep('profile')}
              />
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
            Add a photo and links so others can recognise you.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  Profile photo saved ✓
                </p>
              )}
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((d) =>
                  updateProfileMutation.mutate(d)
                )}
                className='space-y-4'
              >
                {/* Name */}
                <div className='grid grid-cols-2 gap-3'>
                  <FormField
                    control={form.control}
                    name='first_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder='Jane' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='last_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder='Smith' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name='phone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Phone number{' '}
                        <span className='text-muted-foreground font-normal'>
                          (optional)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder='(555) 555-5555'
                          inputMode='tel'
                          value={
                            field.value ? formatPhoneDisplay(field.value) : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '')
                            if (!raw) field.onChange('')
                            else if (raw.length === 10)
                              field.onChange(`+1${raw}`)
                            else if (raw.startsWith('1') && raw.length === 11)
                              field.onChange(`+${raw}`)
                            else field.onChange(`+${raw}`)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='space-y-3'>
                  <p className='text-sm font-medium'>Company and address</p>

                  <FormField
                    control={form.control}
                    name='organization_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-muted-foreground text-xs font-normal'>
                          Company or organization
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Acme Foundation'
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
                    name='address_line1'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-muted-foreground text-xs font-normal'>
                          Address line 1
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='123 Main St'
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
                    name='address_line2'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-muted-foreground text-xs font-normal'>
                          Address line 2
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder='Suite 200'
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid grid-cols-2 gap-3'>
                    <FormField
                      control={form.control}
                      name='city'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            City
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='Nashville'
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
                      name='state'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            State
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='TN'
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className='grid grid-cols-2 gap-3'>
                    <FormField
                      control={form.control}
                      name='postal_code'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            Postal code
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='37203'
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
                      name='country'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-muted-foreground text-xs font-normal'>
                            Country
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder='United States'
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Social profiles */}
                <div className='space-y-3'>
                  <p className='text-sm font-medium'>Social profiles</p>

                  <FormField
                    control={form.control}
                    name='linkedin'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className='text-muted-foreground text-xs font-normal'>
                          LinkedIn username
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
                          X / Twitter handle
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
                            placeholder='yoursite.com'
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
                    className='w-full'
                    onClick={handleSkip}
                    disabled={updateProfileMutation.isPending}
                  >
                    Skip for now
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
