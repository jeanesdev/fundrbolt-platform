import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  buildAdminPortalNpoOnboardingUrl,
  buildAdminPortalSignUpUrl,
} from '@/lib/admin-portal'
import { Link, useSearch } from '@tanstack/react-router'
import { Building2, HandCoins, Users } from 'lucide-react'
import { AuthLayout } from '../auth-layout'
import { DonorSignUpWizard } from './components/DonorSignUpWizard'

export function SignUp() {
  const { intent } = useSearch({ from: '/(auth)/sign-up' })

  if (intent !== 'donor') {
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
                    Start the staged onboarding flow in the admin app: create
                    your account, verify your email, then enter your
                    organization and first event details.
                  </p>
                </div>
              </div>
              <Button asChild className='w-full'>
                <a href={buildAdminPortalNpoOnboardingUrl()}>
                  Continue as Organization Administrator
                </a>
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
                    Create your account in the admin app if you were invited by
                    an NPO or need access to the admin experience.
                  </p>
                </div>
              </div>
              <Button asChild variant='outline' className='w-full'>
                <a href={buildAdminPortalSignUpUrl('staff')}>
                  Continue as Event Staff
                </a>
              </Button>
            </div>

            <div className='rounded-xl border p-5'>
              <div className='mb-4 flex items-start gap-3'>
                <div className='bg-primary/10 text-primary rounded-lg p-2'>
                  <HandCoins className='h-5 w-5' />
                </div>
                <div>
                  <h3 className='font-semibold'>Donor</h3>
                  <p className='text-muted-foreground text-sm'>
                    Create a donor account here for ticketing, bidding, and
                    donor-facing event flows.
                  </p>
                </div>
              </div>
              <Button asChild variant='outline' className='w-full'>
                <Link to='/sign-up' search={{ intent: 'donor' }}>
                  Create donor account
                </Link>
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

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardContent className='pt-6'>
          <DonorSignUpWizard />
        </CardContent>
        <CardFooter className='justify-center pt-0'>
          <p className='text-muted-foreground text-center text-sm'>
            Need a different account type?{' '}
            <Link
              to='/sign-up'
              className='hover:text-primary underline underline-offset-4'
            >
              Go back
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
