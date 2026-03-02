'use client'

import axios from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type User } from '../data/schema'

type UsersResetPasswordDialogProps = {
  currentRow?: User
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersResetPasswordDialog({
  currentRow,
  open,
  onOpenChange,
}: UsersResetPasswordDialogProps) {
  const queryClient = useQueryClient()

  const resetPassword = useMutation({
    mutationFn: async (email: string) => {
      const response = await axios.post('/api/v1/auth/password/reset/request', {
        email,
      })
      return response.data
    },
    onSuccess: () => {
      toast.success('Password reset email sent successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } }
      const message =
        err?.response?.data?.detail || 'Failed to send password reset email'
      toast.error(message)
    },
  })

  const handleConfirm = async () => {
    if (currentRow?.email) {
      await resetPassword.mutateAsync(currentRow.email)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Send a password reset email to <strong>{currentRow?.email}</strong>?
            <br />
            <br />
            The user will receive an email with instructions to reset their
            password.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={resetPassword.isPending}>
            {resetPassword.isPending ? 'Sending...' : 'Send Reset Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
