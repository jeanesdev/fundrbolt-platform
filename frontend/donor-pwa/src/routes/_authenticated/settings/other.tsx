import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckCircle,
  ChevronDown,
  ClipboardList,
  LifeBuoy,
  Mail,
  Send,
  Shield,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEventContextStore } from '@/stores/event-context-store'
import { sendSupportMessage } from '@/lib/api/support'
import { getDonorSurveyStatus } from '@/lib/api/survey'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ConsentHistory } from '@/components/legal/consent-history'
import { DataRightsForm } from '@/components/legal/data-rights-form'
import { ContentSection } from '@/features/settings/components/content-section'

const SUPPORT_EMAIL = 'support@fundrbolt.com'

const REASON_OPTIONS = [
  { value: 'bug', label: 'Report a bug/issue' },
  { value: 'event-inquiry', label: 'Inquire about another event' },
  { value: 'account', label: 'Account or billing question' },
  { value: 'feature-request', label: 'Feature request' },
  { value: 'general', label: 'General question' },
  { value: 'other', label: 'Other' },
] as const

const supportReasonValues = [
  'bug',
  'event-inquiry',
  'account',
  'feature-request',
  'general',
  'other',
] as const

const supportFormSchema = z.object({
  reason: z.enum(supportReasonValues, {
    message: 'Please select a reason',
  }),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must be under 200 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be under 5000 characters'),
})

type SupportFormValues = z.infer<typeof supportFormSchema>

function SupportForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SupportFormValues>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      reason: undefined as unknown as SupportFormValues['reason'],
      subject: '',
      message: '',
    },
  })

  async function onSubmit(values: SupportFormValues) {
    setIsSubmitting(true)
    try {
      await sendSupportMessage(values)

      toast.success('Message sent to support', {
        description: 'The team will reply by email as soon as possible.',
      })
      form.reset()
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { detail?: unknown } }
        message?: string
      }

      const detail = axiosError.response?.data?.detail
      const message =
        axiosError.response?.status === 429
          ? 'You have sent too many messages recently. Please wait a moment before trying again.'
          : typeof detail === 'string'
            ? detail
            : detail && typeof detail === 'object' && 'error' in detail
              ? ((detail as { error?: { message?: string } }).error?.message ??
                axiosError.message)
              : (axiosError.message ??
                'Failed to send message. Please try again.')

      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='reason'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for contacting</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select a reason...' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='subject'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder='Brief summary of your request' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='message'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Describe your issue or question in detail...'
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' disabled={isSubmitting} className='w-full'>
          <Send className='mr-2 h-4 w-4' />
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </Button>
      </form>
    </Form>
  )
}

function SurveyStatusSection() {
  const selectedEventId = useEventContextStore((s) => s.selectedEventId)
  const selectedEventSlug = useEventContextStore((s) => s.selectedEventSlug)
  const selectedEventName = useEventContextStore((s) => s.selectedEventName)

  const surveyQuery = useQuery({
    queryKey: ['donor-survey-status', selectedEventId],
    queryFn: () => getDonorSurveyStatus(selectedEventId!),
    enabled: Boolean(selectedEventId),
    staleTime: 60_000,
  })

  const survey = surveyQuery.data

  // No active survey for this event or no event selected
  if (!selectedEventId || !selectedEventSlug || !survey?.survey) {
    return (
      <Card>
        <CardContent className='py-4'>
          <p className='text-muted-foreground text-sm'>
            {selectedEventId
              ? 'No survey is currently active for this event.'
              : 'Select an event to see survey status.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const discountDollars = survey.discount_cents_applied
    ? (survey.discount_cents_applied / 100).toFixed(2)
    : null

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base'>{selectedEventName}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex items-center gap-2'>
          {survey.is_completed ? (
            <>
              <CheckCircle className='h-5 w-5 text-green-500' />
              <span className='text-sm font-medium'>Survey completed</span>
            </>
          ) : (
            <>
              <ClipboardList className='text-muted-foreground h-5 w-5' />
              <span className='text-muted-foreground text-sm'>
                Survey not yet completed
              </span>
            </>
          )}
        </div>

        {discountDollars && (
          <div className='flex items-center gap-2'>
            <Tag className='h-4 w-4 text-green-500' />
            <span className='text-sm text-green-700 dark:text-green-400'>
              ${discountDollars} discount earned
            </span>
          </div>
        )}

        <Button asChild variant='outline' size='sm'>
          <Link to='/events/$slug/survey' params={{ slug: selectedEventSlug }}>
            {survey.is_completed ? 'Retake survey' : 'Take survey'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function SettingsOther() {
  return (
    <div className='space-y-4'>
      {/* Survey Section — collapsed by default */}
      <Collapsible>
        <CollapsibleTrigger className='group flex w-full items-center justify-between rounded-lg border p-4'>
          <div className='flex items-center gap-2'>
            <ClipboardList className='h-5 w-5' />
            <h2 className='text-lg font-semibold'>Event Survey</h2>
          </div>
          <ChevronDown className='h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180' />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='pt-4'>
            <SurveyStatusSection />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Support Section — open by default */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className='group flex w-full items-center justify-between rounded-lg border p-4'>
          <div className='flex items-center gap-2'>
            <LifeBuoy className='h-5 w-5' />
            <h2 className='text-lg font-semibold'>Contact Support</h2>
          </div>
          <ChevronDown className='h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180' />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='space-y-4 pt-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>FundrBolt Support</CardTitle>
                <CardDescription>
                  Fill out the form below and we will get back to you as soon as
                  possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SupportForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Mail className='h-4 w-4' />
                  Email Us Directly
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-muted-foreground text-sm'>
                  You can also reach FundrBolt Support directly at:
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className='text-primary mt-2 inline-block text-sm font-medium hover:underline'
                >
                  {SUPPORT_EMAIL}
                </a>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Privacy Section — collapsed by default */}
      <Collapsible>
        <CollapsibleTrigger className='group flex w-full items-center justify-between rounded-lg border p-4'>
          <div className='flex items-center gap-2'>
            <Shield className='h-5 w-5' />
            <h2 className='text-lg font-semibold'>Privacy</h2>
          </div>
          <ChevronDown className='h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180' />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='space-y-6 pt-4'>
            <ContentSection
              title='Consent History'
              desc='View your consent history and legal document acceptance records.'
            >
              <ConsentHistory />
            </ContentSection>

            <ContentSection
              title='Your Data Rights'
              desc='Exercise your GDPR rights to access, export, or delete your personal data.'
            >
              <DataRightsForm />
            </ContentSection>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <p className='text-muted-foreground/60 pt-4 pb-2 text-center text-xs tabular-nums'>
        v{__APP_VERSION__}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/other')({
  component: SettingsOther,
})
