/**
 * Terms of Service Page
 * Standalone page to view the current Terms of Service document
 */

import { LegalDocumentViewer } from '@/components/legal/legal-document-viewer'
import { Button } from '@/components/ui/button'
import { useLegalDocuments } from '@/hooks/use-legal-documents'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'

export function TermsOfServicePage() {
  const { termsOfService, isLoading, error } = useLegalDocuments()

  return (
    <div className='container mx-auto max-w-4xl px-4 py-8'>
      <div className='mb-6'>
        <Button variant='ghost' asChild className='mb-4'>
          <Link to='/'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Back to Home
          </Link>
        </Button>
        <h1 className='text-3xl font-bold'>Terms of Service</h1>
        <p className='mt-2 text-muted-foreground'>
          Please read these terms carefully before using our platform.
        </p>
      </div>

      {isLoading && (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      )}

      {error && (
        <div className='rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive'>
          <p className='font-semibold'>Error loading Terms of Service</p>
          <p className='text-sm'>{error}</p>
        </div>
      )}

      {termsOfService && !isLoading && (
        <div className='mb-8'>
          <LegalDocumentViewer document={termsOfService} />
        </div>
      )}

      {!termsOfService && !isLoading && !error && (
        <div className='rounded-lg border border-muted bg-muted/10 p-8 text-center'>
          <p className='text-muted-foreground'>
            Terms of Service document is not currently available.
          </p>
        </div>
      )}

      <div className='mt-8 border-t pt-6'>
        <p className='text-sm text-muted-foreground'>
          Questions about our Terms of Service? Contact us for assistance.
        </p>
      </div>
    </div>
  )
}
