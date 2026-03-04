/**
 * DuplicateEventDialog
 *
 * Radix UI AlertDialog for confirming event duplication.
 * Shows the source event name, the proposed clone name,
 * and three checkboxes for optional inclusions (media, links, labels).
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { DuplicateEventOptions } from '@/types/event'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useEventStore } from '@/stores/event-store'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DuplicateEventDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** UUID of the source event */
  eventId: string
  /** Name of the source event (displayed in confirmation) */
  eventName: string
}

export function DuplicateEventDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
}: DuplicateEventDialogProps) {
  const navigate = useNavigate()
  const { duplicateEvent } = useEventStore()

  const [isLoading, setIsLoading] = useState(false)
  const [includeMedia, setIncludeMedia] = useState(false)
  const [includeLinks, setIncludeLinks] = useState(true)
  const [includeDonationLabels, setIncludeDonationLabels] = useState(true)

  const proposedName = `${eventName} (Copy)`.slice(0, 255)

  const handleConfirm = async (e: React.MouseEvent) => {
    // Prevent default so AlertDialogAction doesn't close automatically
    e.preventDefault()
    setIsLoading(true)

    const options: DuplicateEventOptions = {
      include_media: includeMedia,
      include_links: includeLinks,
      include_donation_labels: includeDonationLabels,
    }

    try {
      const newEvent = await duplicateEvent(eventId, options)
      toast.success(`Event duplicated: "${newEvent.name}"`)
      onOpenChange(false)
      navigate({
        to: '/events/$eventId/edit',
        params: { eventId: newEvent.id },
      })
    } catch (_err) {
      toast.error('Failed to duplicate event')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Event</AlertDialogTitle>
          <AlertDialogDescription>
            Create a copy of <strong>{eventName}</strong> as a new DRAFT event
            named <strong>{proposedName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='space-y-3 py-2'>
          <p className='text-muted-foreground text-sm font-medium'>
            Include optional content:
          </p>

          <div className='flex items-center gap-2'>
            <Checkbox
              id='include-media'
              checked={includeMedia}
              onCheckedChange={(v) => setIncludeMedia(v === true)}
              disabled={isLoading}
            />
            <Label htmlFor='include-media' className='cursor-pointer text-sm'>
              Include media files
            </Label>
          </div>

          <div className='flex items-center gap-2'>
            <Checkbox
              id='include-links'
              checked={includeLinks}
              onCheckedChange={(v) => setIncludeLinks(v === true)}
              disabled={isLoading}
            />
            <Label htmlFor='include-links' className='cursor-pointer text-sm'>
              Include external links
            </Label>
          </div>

          <div className='flex items-center gap-2'>
            <Checkbox
              id='include-labels'
              checked={includeDonationLabels}
              onCheckedChange={(v) => setIncludeDonationLabels(v === true)}
              disabled={isLoading}
            />
            <Label htmlFor='include-labels' className='cursor-pointer text-sm'>
              Include donation labels
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Duplicating…
              </>
            ) : (
              'Duplicate'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
