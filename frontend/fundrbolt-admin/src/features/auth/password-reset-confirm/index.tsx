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
import { PasswordResetConfirmForm } from './components/password-reset-confirm-form'

interface PasswordResetConfirmProps {
  token?: string
  mode?: 'setup'
}

export function PasswordResetConfirm({ token, mode }: PasswordResetConfirmProps) {
  const isAccountSetup = mode === 'setup'
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {isAccountSetup ? 'Set Your Password' : 'Create New Password'}
          </CardTitle>
          <CardDescription>
            {isAccountSetup
              ? 'Choose a password to activate your account.'
              : 'Enter your reset token and choose a new password for your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordResetConfirmForm token={token} mode={mode} />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground mx-auto px-8 text-center text-sm text-balance'>
            Remember your password?{' '}
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
