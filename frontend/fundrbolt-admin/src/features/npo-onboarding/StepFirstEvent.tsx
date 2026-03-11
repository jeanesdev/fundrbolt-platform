/**
 * StepFirstEvent — optional first event creation step.
 *
 * Collects: event name, event date, event type.
 * A clearly-labelled "Skip for now" action bypasses this step entirely.
 */
import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateStep } from '@/lib/api/onboarding'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ---------------------------------------------------------------------------
// Event types matching platform conventions
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  { value: 'GALA', label: 'Gala / Dinner' },
  { value: 'AUCTION', label: 'Auction' },
  { value: 'GOLF_TOURNAMENT', label: 'Golf Tournament' },
  { value: 'FUN_RUN', label: 'Fun Run / Walk' },
  { value: 'CONCERT', label: 'Concert / Performance' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'CONFERENCE', label: 'Conference / Symposium' },
  { value: 'OTHER', label: 'Other' },
] as const

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// Minimum event date: today
const todayStr = new Date().toISOString().split('T')[0]

const formSchema = z.object({
  event_name: z
    .string()
    .min(2, 'Event name is required (min 2 chars)')
    .max(255),
  event_date: z
    .string()
    .min(1, 'Event date is required')
    .refine((d) => d >= todayStr, 'Event date must be today or in the future'),
  event_type: z.string().min(1, 'Please select an event type'),
})

type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepFirstEventProps {
  sessionToken: string
  initialValues?: Partial<FormValues>
  onNext: (values: FormValues | null) => void
  onBack?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepFirstEvent({
  sessionToken,
  initialValues,
  onNext,
  onBack,
}: StepFirstEventProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      event_name: initialValues?.event_name ?? '',
      event_date: initialValues?.event_date ?? '',
      event_type: initialValues?.event_type ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      await updateStep(sessionToken, 'first_event', values)
      onNext(values)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? 'Failed to save. Please try again.'
      toast.error(msg)
      setIsLoading(false)
    }
  }

  const handleSkip = async () => {
    setIsSkipping(true)
    try {
      // Mark step as skipped (empty payload)
      await updateStep(sessionToken, 'first_event', { skipped: true })
    } catch {
      // Non-fatal; proceed anyway
    } finally {
      setIsSkipping(false)
      onNext(null)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-bold'>Plan your first event</h2>
        <p className='text-muted-foreground text-sm'>
          Give us a head start on setting up your first fundraising event. You
          can change these details later, or skip this step entirely.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          {/* Event name */}
          <FormField
            control={form.control}
            name='event_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event name</FormLabel>
                <FormControl>
                  <Input placeholder='Annual Spring Gala 2026' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Event date */}
          <FormField
            control={form.control}
            name='event_date'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event date</FormLabel>
                <FormControl>
                  <Input type='date' min={todayStr} {...field} />
                </FormControl>
                <FormDescription>
                  Approximate date is fine — you can adjust it later.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Event type */}
          <FormField
            control={form.control}
            name='event_type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Event type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a type…' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {EVENT_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        {et.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex gap-2'>
            {onBack && (
              <Button
                type='button'
                variant='outline'
                onClick={onBack}
                disabled={isLoading || isSkipping}
                className='flex-1'
              >
                Back
              </Button>
            )}
            <Button
              type='submit'
              className='flex-1'
              disabled={isLoading || isSkipping}
            >
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

      {/* Skip option */}
      <div className='flex justify-center'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={handleSkip}
          disabled={isLoading || isSkipping}
          className='text-muted-foreground text-sm'
        >
          {isSkipping ? (
            <Loader2 className='mr-2 h-3 w-3 animate-spin' />
          ) : null}
          Skip for now — I'll set this up after approval
        </Button>
      </div>
    </div>
  )
}
