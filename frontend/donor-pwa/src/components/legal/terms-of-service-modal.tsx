/**
 * TermsOfServiceModal component
 * Modal for displaying and accepting Terms of Service
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useLegalDocuments } from '@/hooks/use-legal-documents'
import { useState } from 'react'
import { LegalDocumentViewer } from './legal-document-viewer'

interface TermsOfServiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccept: (tosId: string, privacyId: string) => Promise<void>
  showPrivacyPolicy?: boolean
}

export function TermsOfServiceModal({
  open,
  onOpenChange,
  onAccept,
  showPrivacyPolicy = true,
}: TermsOfServiceModalProps) {
  const { termsOfService, privacyPolicy, isLoading } = useLegalDocuments()
  const [tosAccepted, setTosAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canAccept = tosAccepted && (!showPrivacyPolicy || privacyAccepted)

  const handleAccept = async () => {
    if (!termsOfService || (showPrivacyPolicy && !privacyPolicy)) {
      return
    }

    setIsSubmitting(true)

    try {
      await onAccept(termsOfService.id, privacyPolicy!.id)
      setTosAccepted(false)
      setPrivacyAccepted(false)
      onOpenChange(false)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch legal documents:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Legal Agreements</AlertDialogTitle>
          <AlertDialogDescription>
            Please review and accept the following legal documents to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading documents...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Terms of Service */}
            {termsOfService && (
              <div className="space-y-3">
                <LegalDocumentViewer document={termsOfService} />
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="tos-accept"
                    checked={tosAccepted}
                    onCheckedChange={(checked) => setTosAccepted(checked === true)}
                  />
                  <label
                    htmlFor="tos-accept"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have read and accept the Terms of Service
                  </label>
                </div>
              </div>
            )}

            {/* Privacy Policy */}
            {showPrivacyPolicy && privacyPolicy && (
              <div className="space-y-3">
                <LegalDocumentViewer document={privacyPolicy} />
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="privacy-accept"
                    checked={privacyAccepted}
                    onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  />
                  <label
                    htmlFor="privacy-accept"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have read and accept the Privacy Policy
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!canAccept || isSubmitting || isLoading}
          >
            {isSubmitting ? 'Accepting...' : 'Accept and Continue'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
