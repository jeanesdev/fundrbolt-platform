/**
 * Application Review Dialog Component
 * Allows SuperAdmin to approve or reject NPO applications
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import npoService from '@/services/npo-service'
import type { NPOApplication } from '@/types/npo'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ApplicationReviewDialogProps {
  application: NPOApplication
  open: boolean
  onClose: () => void
  onReviewComplete: () => void
}

export function ApplicationReviewDialog({
  application,
  open,
  onClose,
  onReviewComplete,
}: ApplicationReviewDialogProps) {
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState<'approve' | 'reject' | null>(null)

  const canReview = application.status === 'submitted' || application.status === 'under_review'

  const handleReview = async (decision: 'approved' | 'rejected') => {
    setIsSubmitting(true)
    try {
      await npoService.admin.reviewApplication(application.npo_id, decision, notes || undefined)
      toast.success(
        decision === 'approved'
          ? 'Application approved successfully'
          : 'Application rejected successfully'
      )
      setShowConfirmation(null)
      onReviewComplete()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to review application:', error)
      toast.error('Failed to review application')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  }

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review and approve or reject this NPO application
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Application Details */}
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Organization</p>
                <p className="text-base font-semibold">{application.npo_name || 'Unknown'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{application.npo_email || 'N/A'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                <p className="text-sm">{formatDate(application.submitted_at)}</p>
              </div>

              {application.reviewed_at && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Reviewed</p>
                    <p className="text-sm">{formatDate(application.reviewed_at)}</p>
                  </div>

                  {application.review_notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Review Notes</p>
                      <p className="text-sm">
                        {typeof application.review_notes === 'string'
                          ? application.review_notes
                          : Object.values(application.review_notes).join(', ')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Review Notes Input (only for pending applications) */}
            {canReview && (
              <div className="space-y-2">
                <Label htmlFor="review-notes">Review Notes (Optional)</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Add notes about your decision..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  These notes will be included in the email to the organization.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {canReview ? 'Cancel' : 'Close'}
            </Button>
            {canReview && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmation('reject')}
                  disabled={isSubmitting}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  onClick={() => setShowConfirmation('approve')}
                  disabled={isSubmitting}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={showConfirmation === 'approve'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this application for{' '}
              <strong>{application.npo_name}</strong>?
              <br />
              <br />
              The organization will be notified via email and their status will be updated to
              "Approved".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowConfirmation(null)}
              disabled={isSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleReview('approved')}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Approving...' : 'Approve Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={showConfirmation === 'reject'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this application for{' '}
              <strong>{application.npo_name}</strong>?
              <br />
              <br />
              The organization will be notified via email and their status will be updated to
              "Rejected".
              {notes && (
                <>
                  <br />
                  <br />
                  <strong>Your notes:</strong> {notes}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowConfirmation(null)}
              disabled={isSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleReview('rejected')}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? 'Rejecting...' : 'Reject Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
