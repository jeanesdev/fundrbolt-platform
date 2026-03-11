/**
 * StepNpoProfile — collects essential NPO details.
 *
 * Required: NPO name, EIN, website URL, phone.
 * Optional: mission / description.
 * Shows a duplicate-name warning banner when the server flags a similar name.
 */
import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateStep } from '@/lib/api/onboarding'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EIN_PATTERN = /^\d{2}-?\d{7}$/

const formSchema = z.object({
  npo_name: z
    .string()
    .min(2, 'Organization name is required (min 2 chars)')
    .max(255),
  ein: z
    .string()
    .min(1, 'EIN is required')
    .regex(EIN_PATTERN, 'EIN must be in the format XX-XXXXXXX'),
  website_url: z
    .string()
    .url('Please enter a valid URL (include https://)')
    .max(500)
    .or(z.literal('')),
  phone: z
    .string()
    .min(10, 'Phone must be at least 10 digits')
    .regex(/^[\d\s+\-().]+$/, 'Invalid phone number'),
  mission: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepNpoProfileProps {
  sessionToken: string
  /** Pre-populated values (e.g., when user navigates back). */
  initialValues?: Partial<FormValues>
  onNext: (values: FormValues) => void
  onBack?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepNpoProfile({
  sessionToken,
  initialValues,
  onNext,
  onBack,
}: StepNpoProfileProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      npo_name: initialValues?.npo_name ?? '',
      ein: initialValues?.ein ?? '',
      website_url: initialValues?.website_url ?? '',
      phone: initialValues?.phone ?? '',
      mission: initialValues?.mission ?? '',
    },
  })

  const saveAndAdvance = async (values: FormValues) => {
    setIsLoading(true)
    setDuplicateWarning(false)
    try {
      await updateStep(
        sessionToken,
        'npo_profile',
        values as unknown as Record<string, unknown>
      )
      onNext(values)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? 'Failed to save. Please try again.'
      toast.error(msg)
      setIsLoading(false)
    }
  }

  const onSubmit = async (values: FormValues) => {
    await saveAndAdvance(values)
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-bold'>Tell us about your organization</h2>
        <p className='text-muted-foreground text-sm'>
          This information will be reviewed by our team before your NPO is
          approved.
        </p>
      </div>

      {/* Duplicate-name warning (surfaced after submission — placeholder, see NpoOnboardingWizard) */}
      {duplicateWarning && (
        <Alert className='border-amber-500 bg-amber-50'>
          <AlertTriangle className='h-4 w-4 text-amber-600' />
          <AlertDescription className='text-amber-900'>
            An organization with a similar name already exists. Consider
            adjusting the name, or continue if this is a different organization.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          {/* NPO Name */}
          <FormField
            control={form.control}
            name='npo_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization name *</FormLabel>
                <FormControl>
                  <Input placeholder='Helping Hands Foundation' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* EIN */}
          <FormField
            control={form.control}
            name='ein'
            render={({ field }) => (
              <FormItem>
                <FormLabel>EIN (Employer Identification Number) *</FormLabel>
                <FormControl>
                  <Input
                    placeholder='12-3456789'
                    autoComplete='off'
                    {...field}
                    onChange={(e) => {
                      // Auto-insert hyphen after 2 digits
                      let v = e.target.value.replace(/[^\d-]/g, '')
                      if (v.length === 2 && !v.includes('-')) v = v + '-'
                      field.onChange(v)
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Your IRS-issued Employer Identification Number (XX-XXXXXXX).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Website */}
          <FormField
            control={form.control}
            name='website_url'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website URL *</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    placeholder='https://www.example.org'
                    {...field}
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
                <FormLabel>Organization phone number *</FormLabel>
                <FormControl>
                  <Input type='tel' placeholder='(555) 000-0000' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Mission */}
          <FormField
            control={form.control}
            name='mission'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mission / description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Briefly describe your organization's mission and the communities you serve..."
                    rows={4}
                    maxLength={1000}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Optional — up to 1000 characters.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex gap-2'>
            {onBack && (
              <Button
                type='button'
                variant='outline'
                className='flex-1'
                onClick={onBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <Button type='submit' className='flex-1' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
