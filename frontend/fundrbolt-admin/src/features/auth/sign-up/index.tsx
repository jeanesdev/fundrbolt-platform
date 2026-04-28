import { Link, useSearch } from '@tanstack/react-router'
import { Building2, HandCoins, Users } from 'lucide-react'
import { buildDonorPortalSignUpUrl } from '@/lib/donor-portal'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserSignUpWizard } from './UserSignUpWizard'

export function SignUp() {
  const { intent } = useSearch({ from: '/(auth)/sign-up' })

  if (intent === 'staff') {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              Event Staff account setup
            </CardTitle>
            <CardDescription>
              Use this path if you were invited to join a team or need an admin
              account before accepting an invitation. Organization
              Administrators should use NPO onboarding instead.{' '}
              <Link
                to='/sign-up'
                className='hover:text-primary underline underline-offset-4'
              >
                Choose a different path
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserSignUpWizard />
          </CardContent>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Card className='gap-6'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Select your account type
          </CardTitle>
          <CardDescription>
            Choose the path that matches what you&apos;re trying to do.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className='rounded-xl border p-5'>
            <div className='mb-4 flex items-start gap-3'>
              <div className='bg-primary/10 text-primary rounded-lg p-2'>
                <Building2 className='h-5 w-5' />
              </div>
              <div>
                <h3 className='font-semibold'>Organization Administrator</h3>
                <p className='text-muted-foreground text-sm'>
                  Start the staged onboarding flow: create your account, verify
                  your email, then enter your organization and first event
                  details.
                </p>
              </div>
            </div>
            <Button asChild className='w-full'>
              <Link to='/register-npo'>
                Continue as Organization Administrator
              </Link>
            </Button>
          </div>

          <div className='rounded-xl border p-5'>
            <div className='mb-4 flex items-start gap-3'>
              <div className='bg-primary/10 text-primary rounded-lg p-2'>
                <Users className='h-5 w-5' />
              </div>
              <div>
                <h3 className='font-semibold'>Event Staff or Team Member</h3>
                <p className='text-muted-foreground text-sm'>
                  Create your account here if you were invited by an NPO or need
                  to access the admin experience.
                </p>
              </div>
            </div>
            <Button asChild variant='outline' className='w-full'>
              <Link to='/sign-up' search={{ intent: 'staff' }}>
                Continue as Event Staff
              </Link>
            </Button>
          </div>

          <div className='rounded-xl border p-5'>
            <div className='mb-4 flex items-start gap-3'>
              <div className='bg-primary/10 text-primary rounded-lg p-2'>
                <HandCoins className='h-5 w-5' />
              </div>
              <div>
                <h3 className='font-semibold'>Attendee</h3>
                <p className='text-muted-foreground text-sm'>
                  Go to the attendee portal for ticketing, bidding, and event
                  flows.
                </p>
              </div>
            </div>
            <Button asChild variant='outline' className='w-full'>
              <a href={buildDonorPortalSignUpUrl()}>Create attendee account</a>
            </Button>
          </div>
        </CardContent>
        <CardFooter className='justify-center pt-0'>
          <p className='text-muted-foreground text-center text-sm'>
            Already have an account?{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary underline underline-offset-4'
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
