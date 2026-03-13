import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { EmailVerificationForm } from './components/email-verification-form'

interface EmailVerificationPageProps {
  token?: string
  email?: string
}

export function EmailVerificationPage({
  token,
  email,
}: EmailVerificationPageProps) {
  const description = token
    ? 'We are verifying your email automatically.'
    : email
      ? 'Check your inbox for the latest verification email.'
      : 'Enter the verification token from your email to activate your account.'

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Verify Your Email
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailVerificationForm token={token} email={email} />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground mx-auto px-8 text-center text-sm text-balance'>
            Already verified?{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary underline underline-offset-4'
            >
              Sign in
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
