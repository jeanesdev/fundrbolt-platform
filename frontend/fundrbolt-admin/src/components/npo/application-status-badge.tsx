/**
 * Application Status Badge Component
 * Displays application status and submit button for NPO Admins
 */

import { NPOLegalAgreementModal } from '@/components/npo/npo-legal-agreement-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { npoService } from '@/services/npo-service'
import { useNPOStore } from '@/stores/npo-store'
import type { NPODetail } from '@/types/npo'
import { AlertCircle, Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ApplicationStatusBadgeProps {
  npo: NPODetail
  onApplicationSubmitted?: () => void
}

// Status badge color mapping
const statusColors = {
  submitted: 'bg-yellow-500',
  under_review: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
} as const

// Status label mapping
const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
} as const

export function ApplicationStatusBadge({
  npo,
  onApplicationSubmitted,
}: ApplicationStatusBadgeProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(false)

  // Validate required fields
  const validateRequiredFields = useCallback((): { valid: boolean; error?: string } => {
    const fieldLabels: Record<string, string> = {
      name: 'Organization Name',
      description: 'Description',
      email: 'Email Address',
      phone: 'Phone Number',
      address: 'Physical Address',
      tax_id: 'Tax ID (EIN)',
    }

    const missingFields: string[] = []
    if (!npo.name) missingFields.push('name')
    if (!npo.description) missingFields.push('description')
    if (!npo.email) missingFields.push('email')
    if (!npo.phone) missingFields.push('phone')
    if (!npo.address) missingFields.push('address')
    if (!npo.tax_id) missingFields.push('tax_id')

    if (missingFields.length > 0) {
      const missingLabels = missingFields.map((field) => fieldLabels[field])
      const error =
        missingLabels.length === 1
          ? `Please complete the required field: ${missingLabels[0]}`
          : `Please complete the following required fields: ${missingLabels.join(', ')}`
      return { valid: false, error }
    }

    return { valid: true }
  }, [npo.name, npo.description, npo.email, npo.phone, npo.address, npo.tax_id])

  // Run validation on mount and whenever NPO data changes
  useEffect(() => {
    const validation = validateRequiredFields()
    if (!validation.valid) {
      setErrorMessage(validation.error!)
    } else {
      setErrorMessage(null)
    }
  }, [npo.name, npo.description, npo.email, npo.phone, npo.address, npo.tax_id, validateRequiredFields])

  // Check if submit button should be disabled
  const isSubmitDisabled = isSubmitting || !!errorMessage

  // Handle click on submit button - show legal modal first
  const handleSubmitClick = () => {
    const validation = validateRequiredFields()
    if (!validation.valid) {
      setErrorMessage(validation.error!)
      return
    }
    // Validation passed, clear any errors and show legal agreement modal
    setErrorMessage(null)
    setShowLegalModal(true)
  }

  // Handle legal agreements accepted - show final confirmation
  const handleLegalAccepted = () => {
    setShowLegalModal(false)
    setShowConfirmDialog(true)
  }

  // Show nothing if NPO status is not draft (already approved, etc.)
  if (npo.status !== 'draft') {
    return null
  }

  // If application exists, show its status
  if (npo.application) {
    const status = npo.application.status
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Application Status:
          </span>
          <Badge
            variant="secondary"
            className={`${statusColors[status]} text-white`}
          >
            {statusLabels[status]}
          </Badge>
        </div>
        {npo.application.submitted_at && (
          <p className="text-xs text-muted-foreground">
            Submitted on {new Date(npo.application.submitted_at).toLocaleDateString()}
          </p>
        )}
        {npo.application.status === 'rejected' && npo.application.review_notes && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/20">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Rejection Reason:
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">
              {typeof npo.application.review_notes === 'string'
                ? npo.application.review_notes
                : Object.values(npo.application.review_notes).join(', ')}
            </p>
          </div>
        )}
      </div>
    )
  }

  // No application yet - show submit button
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Call API directly to avoid setting global store error
      const updatedNpo = await npoService.application.submitApplication(npo.id)

      // Update store manually using Zustand's set function
      useNPOStore.setState((state) => ({
        npos: state.npos.map((n) => (n.id === npo.id ? updatedNpo : n)),
        currentNPO: state.currentNPO?.id === npo.id
          ? { ...state.currentNPO, ...updatedNpo }
          : state.currentNPO,
      }))

      setShowConfirmDialog(false) // Close confirmation dialog on success
      toast.success('Application submitted successfully')
      onApplicationSubmitted?.()
    } catch (error: unknown) {
      // Extract user-friendly error message
      let message = 'Failed to submit application. Please try again.'

      if (error && typeof error === 'object' && 'response' in error) {
        const response = error.response as { data?: { detail?: string | { message?: string } } }
        if (response?.data?.detail) {
          const detail = response.data.detail
          if (typeof detail === 'string') {
            message = detail
          } else if (detail && typeof detail === 'object' && 'message' in detail) {
            message = detail.message as string
          }
        }
      }

      setShowConfirmDialog(false) // Close confirmation dialog on error
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Validation Error Message */}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Application Status:
        </span>
        <Badge variant="outline">Draft (Not Submitted)</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Your organization profile is in draft status. Submit an application for approval.
      </p>

      {/* Submit Button - disabled until all required fields are complete */}
      <Button size="sm" disabled={isSubmitDisabled} onClick={handleSubmitClick}>
        <Send className="mr-2 h-4 w-4" />
        Submit for Approval
      </Button>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Application for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit your organization for approval? Once submitted,
              you won't be able to edit some details until the review is complete.
              <br />
              <br />
              Our team will review your application and get back to you within 3-5 business days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleSubmit()
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Legal Agreement Modal */}
      <NPOLegalAgreementModal
        open={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        onAccepted={handleLegalAccepted}
      />
    </div>
  )
}
