import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordChangeForm } from '@/features/settings/account/components/password-change-form'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'

function SettingsPassword() {
  return (
    <div className='w-full max-w-2xl space-y-6'>
      <div>
        <h3 className='text-lg font-medium'>Change Password</h3>
        <p className='text-sm text-muted-foreground'>
          Update your password to keep your account secure
        </p>
      </div>

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
          <PasswordChangeForm />
        </CardContent>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/password')({
  component: SettingsPassword,
})
