/**
 * SponsorsTab
 * Tab content for managing event sponsors with create/edit/delete
 */

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSponsorStore } from '@/stores/sponsorStore'
import type { Sponsor, SponsorCreateRequest, SponsorUpdateRequest } from '@/types/sponsor'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SponsorForm } from './SponsorForm'
import { SponsorList } from './SponsorList'

interface SponsorsTabProps {
  eventId: string
}

export function SponsorsTab({ eventId }: SponsorsTabProps) {
  const {
    sponsors,
    isLoading,
    error,
    fetchSponsors,
    createSponsor,
    updateSponsor,
    deleteSponsor,
    clearError,
  } = useSponsorStore()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null)
  const [deletingSponsor, setDeletingSponsor] = useState<Sponsor | null>(null)

  useEffect(() => {
    fetchSponsors(eventId).catch(() => {
      toast.error('Failed to load sponsors')
    })
  }, [eventId, fetchSponsors])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  const handleAdd = () => {
    setEditingSponsor(null)
    setIsFormOpen(true)
  }

  const handleEdit = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor)
    setIsFormOpen(true)
  }

  const handleDelete = (sponsor: Sponsor) => {
    setDeletingSponsor(sponsor)
  }

  const confirmDelete = async () => {
    if (!deletingSponsor) return

    setIsSubmitting(true)
    try {
      await deleteSponsor(eventId, deletingSponsor.id)
      toast.success('Sponsor deleted successfully')
      setDeletingSponsor(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete sponsor')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (data: SponsorCreateRequest | SponsorUpdateRequest, logoFile?: File) => {
    setIsSubmitting(true)
    try {
      if (editingSponsor) {
        // Update existing sponsor
        await updateSponsor(eventId, editingSponsor.id, data as SponsorUpdateRequest)

        // If logo file provided, upload it separately
        if (logoFile) {
          const { uploadLogo } = useSponsorStore.getState()
          await uploadLogo(eventId, editingSponsor.id, logoFile)
        }

        toast.success('Sponsor updated successfully')
      } else {
        // Create new sponsor (with logo upload)
        // eslint-disable-next-line no-console
        console.log('Creating sponsor with data:', data, 'Logo file:', logoFile?.name, logoFile?.size)
        await createSponsor(eventId, data as SponsorCreateRequest, logoFile)
        toast.success('Sponsor created successfully')
      }

      setIsFormOpen(false)
      setEditingSponsor(null)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Sponsor save error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save sponsor'
      toast.error(errorMessage)
      // Don't close dialog on error so user can retry
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setIsFormOpen(false)
    setEditingSponsor(null)
  }

  return (
    <div className="space-y-6">
      <SponsorList
        sponsors={sponsors}
        isLoading={isLoading}
        error={error}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSponsor ? 'Edit Sponsor' : 'Add Sponsor'}</DialogTitle>
            <DialogDescription>
              {editingSponsor
                ? 'Update sponsor information and logo'
                : 'Add a new sponsor to showcase their support'}
            </DialogDescription>
          </DialogHeader>
          <SponsorForm
            sponsor={editingSponsor || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSponsor} onOpenChange={(open) => !open && setDeletingSponsor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sponsor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingSponsor?.name}</strong>?
              This will permanently remove the sponsor and their logo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
