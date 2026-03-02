import { Separator } from '@/components/ui/separator'
import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'
import { PasswordChangeForm } from './components/password-change-form'

export function SettingsAccount() {
  return (
    <div className='space-y-6'>
      <ContentSection
        title='Account'
        desc='Update your account settings. Set your preferred language and
          timezone.'
      >
        <AccountForm />
      </ContentSection>

      <Separator />

      <ContentSection
        title='Password'
        desc='Change your password. Make sure to use a strong password with at least 8 characters.'
      >
        <PasswordChangeForm />
      </ContentSection>
    </div>
  )
}
