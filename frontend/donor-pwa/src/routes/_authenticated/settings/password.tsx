import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordChangeForm } from '@/features/settings/account/components/password-change-form'

function SettingsPassword() {
  const hasLocalPassword = useAuthStore(
    (state) => state.user?.has_local_password
  )
  const isRecoveryPasswordMode = hasLocalPassword === false

  return (
    <div className='w-full max-w-2xl space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>
          {isRecoveryPasswordMode ? 'Set Recovery Password' : 'Change Password'}
        </h3>
        <p className='text-muted-foreground text-sm'>
          {isRecoveryPasswordMode
            ? 'Create a recovery password so you can sign in if OAuth is unavailable.'
            : 'Update your password to keep your account secure'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <KeyRound className='h-5 w-5' />
            {isRecoveryPasswordMode
              ? 'Recovery Password Settings'
              : 'Password Settings'}
          </CardTitle>
          <CardDescription>
            Your password must be at least 8 characters and contain both letters
            and numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/password')({
  component: SettingsPassword,
})
