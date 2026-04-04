import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { StepVerifyEmail } from '../sign-up-wizard/StepVerifyEmail'
import { EmailVerificationForm } from './components/email-verification-form'

interface EmailVerificationPageProps {
  token?: string
  email?: string
}

export function EmailVerificationPage({
  token,
  email,
}: EmailVerificationPageProps) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  const handleVerificationComplete = () => {
    navigate({ to: isAuthenticated ? '/' : '/sign-in' })
  }

  const isCodeVerificationFlow = Boolean(email && !token)

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Verify Your Email
          </CardTitle>
          <CardDescription>
            {isCodeVerificationFlow ? (
              <>
                Enter the 6-digit code from your email to activate your account.
              </>
            ) : (
              <>
                Enter the verification token from your <br /> email to activate
                your account.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCodeVerificationFlow && email ? (
            <StepVerifyEmail
              email={email}
              onNext={handleVerificationComplete}
            />
          ) : (
            <EmailVerificationForm token={token} email={email} />
          )}
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
