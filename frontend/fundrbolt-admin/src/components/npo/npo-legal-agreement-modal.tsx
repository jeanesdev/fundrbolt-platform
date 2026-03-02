/**
 * NPOLegalAgreementModal component
 * Modal for accepting legal agreements before NPO submission
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { LegalDocumentViewer } from '@/components/legal/legal-document-viewer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { consentService } from '@/services/consent-service'
import { legalService } from '@/services/legal-service'

interface NPOLegalAgreementModalProps {
  open: boolean
  onClose: () => void
  onAccepted: () => void
}

export function NPOLegalAgreementModal({
  open,
  onClose,
  onAccepted,
}: NPOLegalAgreementModalProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)

  // Fetch legal documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['legal-documents'],
    queryFn: () => legalService.fetchAllDocuments(),
    enabled: open,
  })

  const termsDocument = documents?.find((doc) => doc.document_type === 'terms_of_service')
  const privacyDocument = documents?.find((doc) => doc.document_type === 'privacy_policy')

  // Accept consent mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!termsDocument || !privacyDocument) {
        throw new Error('Legal documents not loaded')
      }

      await consentService.acceptConsent({
        tos_document_id: termsDocument.id,
        privacy_document_id: privacyDocument.id,
      })
    },
    onSuccess: () => {
      toast.success('Legal agreements accepted')
      onAccepted()
    },
    onError: () => {
      toast.error('Failed to accept legal agreements. Please try again.')
    },
  })

  const handleAccept = () => {
    if (!acceptedTerms || !acceptedPrivacy) {
      toast.error('You must accept both agreements to continue')
      return
    }

    acceptMutation.mutate()
  }

  const handleClose = () => {
    if (!acceptMutation.isPending) {
      setAcceptedTerms(false)
      setAcceptedPrivacy(false)
      onClose()
    }
  }

  const canSubmit = acceptedTerms && acceptedPrivacy && !acceptMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Legal Agreements Required</DialogTitle>
          <DialogDescription>
            Before submitting your NPO application for approval, you must review and accept our
            Terms of Service and Privacy Policy.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Terms of Service */}
              {termsDocument && (
                <div className="space-y-3">
                  <LegalDocumentViewer document={termsDocument} />
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                      disabled={acceptMutation.isPending}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="accept-terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        I have read and accept the Terms of Service
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Version {termsDocument.version} • Published{' '}
                        {new Date(termsDocument.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    {acceptedTerms && <Check className="h-5 w-5 text-green-600 ml-auto" />}
                  </div>
                </div>
              )}

              <Separator />

              {/* Privacy Policy */}
              {privacyDocument && (
                <div className="space-y-3">
                  <LegalDocumentViewer document={privacyDocument} />
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <Checkbox
                      id="accept-privacy"
                      checked={acceptedPrivacy}
                      onCheckedChange={(checked) => setAcceptedPrivacy(checked as boolean)}
                      disabled={acceptMutation.isPending}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="accept-privacy"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        I have read and accept the Privacy Policy
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Version {privacyDocument.version} • Published{' '}
                        {new Date(privacyDocument.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    {acceptedPrivacy && <Check className="h-5 w-5 text-green-600 ml-auto" />}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={acceptMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!canSubmit}>
            {acceptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
