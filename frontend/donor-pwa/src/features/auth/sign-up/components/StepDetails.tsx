import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
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
    .max(255, 'Must not exceed 255 characters')
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

const formatPhoneNumber = (value: string): string => {
  const phoneNumber = value.replace(/\D/g, '')
  if (phoneNumber.length === 0) return ''
  if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    const digits = phoneNumber.slice(1)
    if (digits.length <= 3) return `+1(${digits}`
    if (digits.length <= 6) return `+1(${digits.slice(0, 3)})${digits.slice(3)}`
    return `+1(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (phoneNumber.length <= 3) return `(${phoneNumber}`
  if (phoneNumber.length <= 6)
    return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3)}`
  return `(${phoneNumber.slice(0, 3)})${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
}

interface StepDetailsProps {
  isLoading: boolean
  error: string | null
  onNext: (data: FormValues) => void
  onSkip: () => void
  onBack: () => void
}

export function StepDetails({
  isLoading,
  error,
  onNext,
  onSkip,
  onBack,
}: StepDetailsProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: '',
      organization_name: '',
    },
  })

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h2 className='text-2xl font-bold'>A little about you</h2>
        <p className='text-muted-foreground text-sm'>
          All fields are optional — you can fill these in later from your
          profile.
        </p>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onNext)} className='space-y-4'>
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
                    type='tel'
                    placeholder='(555) 000-0000'
                    {...field}
                    onChange={(e) =>
                      field.onChange(formatPhoneNumber(e.target.value))
                    }
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
                <FormLabel>
                  Company or organization{' '}
                  <span className='text-muted-foreground font-normal'>
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder='Acme Corp' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex flex-col gap-2 pt-2'>
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating account…
                </>
              ) : (
                'Continue'
              )}
            </Button>
            <Button
              type='button'
              variant='ghost'
              className='w-full'
              disabled={isLoading}
              onClick={onSkip}
            >
              Skip for now
            </Button>
          </div>
        </form>
      </Form>

      <Button
        variant='link'
        size='sm'
        className='mx-auto flex'
        onClick={onBack}
        disabled={isLoading}
      >
        ← Back
      </Button>
    </div>
  )
}
