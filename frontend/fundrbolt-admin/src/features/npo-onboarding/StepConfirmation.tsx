/**
 * StepConfirmation — final step displayed after a successful submission.
 *
 * Explains:
 * - Application is under review (status: PENDING_APPROVAL)
 * - Typical review timeline: 3–5 business days
 * - What the applicant can expect next (email notification, admin approval)
 */
import { CheckCircle2, Clock, Mail, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepConfirmationProps {
  /** Applicant's first name (used for personalised greeting). */
  firstName: string
  /** NPO name supplied in the profile step. */
  npoName: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepConfirmation({
  firstName,
  npoName,
}: StepConfirmationProps) {
  return (
    <div className='space-y-8 text-center'>
      {/* Hero icon + heading */}
      <div className='flex flex-col items-center gap-4'>
        <div className='flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
          <CheckCircle2 className='h-10 w-10 text-green-600' />
        </div>
        <div className='space-y-1'>
          <h2 className='text-2xl font-bold'>Application submitted!</h2>
          <p className='text-muted-foreground'>
            Thanks, {firstName}! We've received your application for{' '}
            <strong>{npoName}</strong>.
          </p>
        </div>
      </div>

      {/* What happens next */}
      <div className='space-y-3'>
        <h3 className='text-muted-foreground text-left text-sm font-semibold tracking-wide uppercase'>
          What happens next
        </h3>

        <div className='grid gap-3 text-left'>
          {/* Step 1 — Review */}
          <Card>
            <CardContent className='flex items-start gap-4 p-4'>
              <Clock className='mt-0.5 h-5 w-5 shrink-0 text-blue-500' />
              <div>
                <p className='font-medium'>Review in progress</p>
                <p className='text-muted-foreground text-sm'>
                  Our team reviews every application to make sure FundrBolt is a
                  great fit. This typically takes{' '}
                  <strong>3–5 business days</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 — Email */}
          <Card>
            <CardContent className='flex items-start gap-4 p-4'>
              <Mail className='mt-0.5 h-5 w-5 shrink-0 text-violet-500' />
              <div>
                <p className='font-medium'>You'll hear from us by email</p>
                <p className='text-muted-foreground text-sm'>
                  We'll send an approval (or follow-up) email to the address you
                  registered with. Check your spam folder if you don't hear back
                  within a week.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 — Go live */}
          <Card>
            <CardContent className='flex items-start gap-4 p-4'>
              <Rocket className='mt-0.5 h-5 w-5 shrink-0 text-orange-500' />
              <div>
                <p className='font-medium'>Once approved — you're live!</p>
                <p className='text-muted-foreground text-sm'>
                  After approval you can log in, set up your event pages, manage
                  donors, and launch your first fundraiser.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA */}
      <Button asChild variant='outline' className='w-full'>
        <a href='https://fundrbolt.com' target='_blank' rel='noreferrer'>
          Return to fundrbolt.com
        </a>
      </Button>
    </div>
  )
}
