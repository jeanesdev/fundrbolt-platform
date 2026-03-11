/**
 * Privacy Policy Page
 * Standalone page to view the current Privacy Policy document
 */
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useLegalDocuments } from '@/hooks/use-legal-documents'
import { Button } from '@/components/ui/button'
import { LegalDocumentViewer } from '@/components/legal/legal-document-viewer'

export function PrivacyPolicyPage() {
  const { privacyPolicy, isLoading, error } = useLegalDocuments()

  return (
    <div className='container mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6'>
        <Button variant='ghost' asChild className='mb-4'>
          <Link to='/'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Home
          </Link>
        </Button>
        <h1 className='text-3xl font-bold'>Privacy Policy</h1>
        <p className='text-muted-foreground mt-2'>
          Learn about how we collect, use, and protect your personal data.
        </p>
      </div>

      {isLoading && (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        </div>
      )}

      {error && (
        <div className='border-destructive bg-destructive/10 text-destructive rounded-lg border p-4'>
          <p className='font-semibold'>Error loading Privacy Policy</p>
          <p className='text-sm'>{error}</p>
        </div>
      )}

      {privacyPolicy && !isLoading && (
        <div className='mb-8'>
          <LegalDocumentViewer document={privacyPolicy} />
        </div>
      )}

      {!privacyPolicy && !isLoading && !error && (
        <div className='border-muted bg-muted/10 rounded-lg border p-8 text-center'>
          <p className='text-muted-foreground'>
            Privacy Policy document is not currently available.
          </p>
        </div>
      )}

      <div className='mt-8 border-t pt-6'>
        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Questions about our Privacy Policy? Contact us for assistance.
          </p>
          <div className='flex gap-4'>
            <Link
              to='/sign-up'
              className='text-primary text-sm font-medium hover:underline'
            >
              Create Account
            </Link>
            <span className='text-muted-foreground'>•</span>
            <span className='text-primary cursor-pointer text-sm font-medium hover:underline'>
              <Link to='/'>Terms of Service</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
