import { createFileRoute } from '@tanstack/react-router'
import { AlertCircle, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordChangeForm } from '@/features/settings/account/components/password-change-form'

function SettingsPassword() {
  const user = useAuthStore((state) => state.user)
  const mustChange = user?.must_change_password === true

  return (
    <div className='w-full max-w-2xl space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>Change Password</h3>
        <p className='text-muted-foreground text-sm'>
          Update your password to keep your account secure
        </p>
      </div>

      {mustChange && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Password change required</AlertTitle>
          <AlertDescription>
            Your account was set up with a temporary password. Please choose a
            new password before continuing.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <KeyRound className='h-5 w-5' />
            Password Settings
          </CardTitle>
          <CardDescription>
            Your password must be at least 8 characters and contain both letters
            and numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm
            onSuccess={() => {
              if (mustChange) {
                useAuthStore
                  .getState()
                  .updateUser({ must_change_password: false })
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/password')({
  component: SettingsPassword,
})
