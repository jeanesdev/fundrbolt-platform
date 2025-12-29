import { ConsentHistory } from '@/components/legal/consent-history'
import { DataRightsForm } from '@/components/legal/data-rights-form'
import { ContentSection } from '@/features/settings/components/content-section'
import { createFileRoute } from '@tanstack/react-router'

function SettingsConsent() {
  return (
    <div className='space-y-8'>
      <ContentSection
        title='Consent History'
        desc='View your consent history and legal document acceptance records.'
      >
        <ConsentHistory />
      </ContentSection>

      <ContentSection
        title='Your Data Rights'
        desc='Exercise your GDPR rights to access, export, or delete your personal data.'
      >
        <DataRightsForm />
      </ContentSection>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/settings/consent')({
  component: SettingsConsent,
})
