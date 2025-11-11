import { TermsOfServiceModal } from '@/components/legal/terms-of-service-modal'
import { PasswordInput } from '@/components/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { consentService } from '@/services/consent-service'
import { useAuthStore } from '@/stores/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { Info, Loader2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z
  .object({
    first_name: z.string().min(1, 'Please enter your first name'),
    last_name: z.string().min(1, 'Please enter your last name'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    phone: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          const digits = val.replace(/\D/g, '')
          return digits.length >= 10 && digits.length <= 11
        },
        { message: 'Phone must be 10 or 11 digits' }
      )
      .refine(
        (val) => {
          if (!val || val === '') return true
          const digits = val.replace(/\D/g, '')
          if (digits.length === 11) return digits.startsWith('1')
          return true
        },
        { message: '11-digit phone must start with 1' }
      ),
    organization_name: z
      .string()
      .max(255, 'Organization name must not exceed 255 characters')
      .optional(),
    address_line1: z
      .string()
      .max(255, 'Street address must not exceed 255 characters')
      .optional(),
    address_line2: z
      .string()
      .max(255, 'Street address must not exceed 255 characters')
      .optional(),
    city: z
      .string()
      .max(100, 'City must not exceed 100 characters')
      .optional(),
    state: z
      .string()
      .max(100, 'State must not exceed 100 characters')
      .optional(),
    postal_code: z
      .string()
      .max(20, 'Postal code must not exceed 20 characters')
      .optional(),
    country: z
      .string()
      .max(100, 'Country must not exceed 100 characters')
      .optional(),
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms of Service and Privacy Policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

// Format phone number as user types
const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''

  // Handle 11-digit numbers with +1
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle 10-digit numbers
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

export function SignUpForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [legalDocumentIds, setLegalDocumentIds] = useState<{ tosId: string; privacyId: string } | null>(null)
  const [invitationContext, setInvitationContext] = useState<{ email: string; npo_name: string; token: string } | null>(null)
  const navigate = useNavigate()
  const register = useAuthStore((state) => state.register)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      organization_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      acceptedTerms: false,
    },
  })

  // Check for invitation token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const redirectParam = urlParams.get('redirect')

    if (redirectParam && redirectParam.includes('token=')) {
      try {
        // Extract token from redirect URL
        const tokenMatch = redirectParam.match(/token=([^&]+)/)
        if (tokenMatch) {
          const token = decodeURIComponent(tokenMatch[1])

          // Decode JWT to get invitation details
          const payload = JSON.parse(atob(token.split('.')[1]))

          if (payload.email && payload.npo_name) {
            setInvitationContext({
              email: payload.email,
              npo_name: payload.npo_name,
              token: token,
            })

            // Pre-fill email (read-only)
            form.setValue('email', payload.email)

            // Pre-fill names if provided
            if (payload.first_name) {
              form.setValue('first_name', payload.first_name)
            }
            if (payload.last_name) {
              form.setValue('last_name', payload.last_name)
            }
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse invitation token:', err)
      }
    }
  }, [form])

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    const { confirmPassword: _, acceptedTerms: __, ...registerData } = data

    try {
      // Register the user
      const response = await register(registerData)

      // If we have legal document IDs, accept them
      if (legalDocumentIds) {
        try {
          await consentService.acceptConsent({
            tos_document_id: legalDocumentIds.tosId,
            privacy_document_id: legalDocumentIds.privacyId,
          })
        } catch (consentError) {
          // eslint-disable-next-line no-console
          console.error('Failed to record consent:', consentError)
          // Don't fail registration if consent recording fails
        }
      }

      toast.success(`Account created! ${response.message}`)

      // If this is an invitation registration, redirect to sign-in with return URL
      if (invitationContext) {
        toast.info(`Now sign in to accept your invitation to ${invitationContext.npo_name}`)
        navigate({
          to: '/sign-in',
          search: { redirect: `/invitations/accept?token=${encodeURIComponent(invitationContext.token)}` },
          replace: true,
        })
      } else {
        navigate({ to: '/sign-in', replace: true })
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: {
            detail?: string | { code?: string; message?: string; details?: unknown }
            error?: { message?: string }
          }
        }
      }

      let errorMessage = 'Registration failed. Please try again.'

      // Handle different error response formats
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail
        } else if (error.response.data.detail.message) {
          errorMessage = error.response.data.detail.message

          // Special handling for duplicate email
          if (error.response.data.detail.code === 'DUPLICATE_EMAIL') {
            errorMessage = 'This email is already registered. Please use the "Log in to accept" link instead.'
          }
        }
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message
      }

      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptLegal = async (tosId: string, privacyId: string) => {
    setLegalDocumentIds({ tosId, privacyId })
    form.setValue('acceptedTerms', true)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        {/* Invitation Context Alert */}
        {invitationContext && (
          <Alert className='bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'>
            <Info className='h-4 w-4 text-blue-600 dark:text-blue-400' />
            <AlertDescription className='text-blue-900 dark:text-blue-100'>
              You're creating an account to join <strong>{invitationContext.npo_name}</strong>.
              After registration, you'll be prompted to sign in and accept the invitation.
            </AlertDescription>
          </Alert>
        )}

        <div className='grid grid-cols-2 gap-3'>
          <FormField
            control={form.control}
            name='first_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder='John' {...field} />
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
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder='Doe' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder='name@example.com'
                  {...field}
                  readOnly={!!invitationContext}
                  className={invitationContext ? 'bg-muted' : ''}
                />
              </FormControl>
              {invitationContext && (
                <p className='text-xs text-muted-foreground'>
                  Email from invitation (cannot be changed)
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder='(123)456-7890 or +1(123)456-7890'
                  value={field.value ? formatPhoneNumber(field.value) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    // Only allow 10 or 11 digits (11 must start with 1)
                    if (
                      digits.length <= 10 ||
                      (digits.length === 11 && digits.startsWith('1'))
                    ) {
                      field.onChange(digits)
                    }
                  }}
                  maxLength={17}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='organization_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name (Optional)</FormLabel>
              <FormControl>
                <Input placeholder='Acme Corporation' {...field} />
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
              <FormLabel>Street Address 1 (Optional)</FormLabel>
              <FormControl>
                <Input placeholder='123 Main Street' {...field} />
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
              <FormLabel>Street Address 2 (Optional)</FormLabel>
              <FormControl>
                <Input placeholder='Apartment, suite, etc.' {...field} />
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
                <FormLabel>City (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder='New York' {...field} />
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
                <FormLabel>State (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder='NY' {...field} />
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
                <FormLabel>Postal Code (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder='10001' {...field} />
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
                <FormLabel>Country (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder='United States' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='acceptedTerms'
          render={({ field }) => (
            <FormItem className='flex flex-row items-start space-x-3 space-y-0'>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel className='text-sm font-normal'>
                  I accept the{' '}
                  <Button
                    type='button'
                    variant='link'
                    className='h-auto p-0 text-sm font-normal underline'
                    onClick={() => setShowLegalModal(true)}
                  >
                    Terms of Service and Privacy Policy
                  </Button>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <UserPlus />}
          Create Account
        </Button>
      </form>
      <TermsOfServiceModal
        open={showLegalModal}
        onOpenChange={setShowLegalModal}
        onAccept={handleAcceptLegal}
      />
    </Form>
  )
}
