/**
 * Application Status Badge Component
 * Displays application status and submit button for NPO Admins
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useNPOStore } from '@/stores/npo-store'
import type { NPODetail } from '@/types/npo'
import { Send } from 'lucide-react'
import { useState } from 'react'
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
  const { submitApplication } = useNPOStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      await submitApplication(npo.id)
      toast.success('Application submitted successfully')
      onApplicationSubmitted?.()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit application:', error)
      toast.error('Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Application Status:
        </span>
        <Badge variant="outline">Draft (Not Submitted)</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Your organization profile is in draft status. Submit an application for approval.
      </p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={isSubmitting}>
            <Send className="mr-2 h-4 w-4" />
            Submit for Approval
          </Button>
        </AlertDialogTrigger>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
