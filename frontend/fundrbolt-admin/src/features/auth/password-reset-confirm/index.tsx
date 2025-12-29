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
}

export function PasswordResetConfirm({ token }: PasswordResetConfirmProps) {
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Create New Password
          </CardTitle>
          <CardDescription>
            Enter your reset token and choose a <br /> new password for your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordResetConfirmForm token={token} />
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
