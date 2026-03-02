/**
 * Consent Settings Page
 * Privacy settings page showing consent history and GDPR data rights
 */

import { ConsentHistory } from '@/components/legal/consent-history'
import { DataRightsForm } from '@/components/legal/data-rights-form'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export function ConsentSettingsPage() {
  return (
    <div className='container mx-auto max-w-6xl px-4 py-8'>
      <div className='mb-6'>
        <Button variant='ghost' asChild className='mb-4'>
          <Link to='/'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Dashboard
          </Link>
        </Button>
        <h1 className='text-3xl font-bold'>Privacy & Consent Settings</h1>
        <p className='mt-2 text-muted-foreground'>
          Manage your consent history and exercise your GDPR data rights
        </p>
      </div>

      <div className='space-y-8'>
        {/* Consent History Table */}
        <section>
          <ConsentHistory />
        </section>

        {/* GDPR Data Rights */}
        <section>
          <h2 className='mb-4 text-2xl font-semibold'>Your Data Rights</h2>
          <DataRightsForm />
        </section>

        {/* Additional Information */}
        <section className='rounded-lg border bg-muted/50 p-6'>
          <h3 className='mb-2 text-lg font-semibold'>About Your Privacy Rights</h3>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>
              Under GDPR, you have the right to access, export, and delete your personal data.
              This page provides tools to exercise those rights.
            </p>
            <p>
              <strong>Data Export:</strong> Request a complete copy of your data in machine-readable
              format.
            </p>
            <p>
              <strong>Withdraw Consent:</strong> Revoke your consent to data processing
              (deactivates account).
            </p>
            <p>
              <strong>Account Deletion:</strong> Request permanent deletion of your account and
              data (30-day grace period).
            </p>
            <p className='mt-4'>
              Questions? Contact our Data Protection Officer at{' '}
              <a href='mailto:privacy@fundrbolt.com' className='underline'>
                privacy@fundrbolt.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
