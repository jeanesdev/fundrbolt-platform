import { Link, useSearch } from '@tanstack/react-router'
import { buildDonorPortalSignInUrl } from '@/lib/donor-portal'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SocialLoginButtons } from './components/social-login-buttons'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
          <SocialLoginButtons redirectTo={redirect} />
        </CardContent>
        <CardFooter className='flex-col gap-4'>
          <p className='text-muted-foreground text-center text-sm'>
            Don&apos;t have an account?{' '}
            <Link
              to='/sign-up'
              className='hover:text-primary underline underline-offset-4'
            >
              Sign up
            </Link>
          </p>
          <p className='text-muted-foreground text-center text-sm'>
            Creating an organization?{' '}
            <Link
              to='/register-npo'
              className='hover:text-primary underline underline-offset-4'
            >
              Start NPO onboarding
            </Link>{' '}
            or{' '}
            <a
              href={buildDonorPortalSignInUrl()}
              className='hover:text-primary underline underline-offset-4'
            >
              use the donor portal
            </a>{' '}
            for donor sign-ins.
          </p>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms-of-service'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy-policy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
