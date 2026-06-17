import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { LifeBuoy, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { sendSupportMessage } from '@/lib/api/support'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

function SettingsSupport() {
  return (
    <div className='space-y-6'>
      <ContentSection
        title='Contact Support'
        desc='Get help from the FundrBolt Support team.'
      >
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <LifeBuoy className='h-4 w-4' />
              FundrBolt Support
            </CardTitle>
            <CardDescription>
              Fill out the form below and we will get back to you as soon as
              possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupportForm />
          </CardContent>
        </Card>
      </ContentSection>

      <ContentSection
        title='Email Us Directly'
        desc='Prefer to send us an email? Use the address below.'
      >
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Mail className='h-4 w-4' />
              General Support Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground text-sm'>
              You can reach FundrBolt Support directly at:
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className='text-primary mt-2 inline-block text-sm font-medium hover:underline'
            >
              {SUPPORT_EMAIL}
            </a>
          </CardContent>
        </Card>
      </ContentSection>

      <p className='text-muted-foreground/50 text-center text-xs tabular-nums'>
        v{__APP_VERSION__}
      </p>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/support')({
  component: SettingsSupport,
})
