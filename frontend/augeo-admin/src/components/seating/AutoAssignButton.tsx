/**
 * AutoAssignButton Component
 *
 * Button with confirmation dialog to automatically assign unassigned guests to tables.
 * Uses party-aware algorithm that keeps registration parties together when possible.
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { autoAssignGuests } from '@/lib/api/admin-seating'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface AutoAssignButtonProps {
  eventId: string
  unassignedCount: number
  disabled?: boolean
}

export function AutoAssignButton({
  eventId,
  unassignedCount,
  disabled = false,
}: AutoAssignButtonProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const autoAssignMutation = useMutation({
    mutationFn: () => autoAssignGuests(eventId),
    onSuccess: (data) => {
      // Invalidate seating queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['seating', eventId] })

      // Show success message with assignment details
      const message = `Assigned ${data.assigned_count} guest${data.assigned_count !== 1 ? 's' : ''} to tables`

      if (data.warnings.length > 0) {
        // Show warnings in a separate toast
        toast.warning(message, {
          description: data.warnings.join(' • '),
          duration: 8000,
        })
      } else {
        toast.success(message)
      }

      if (data.unassigned_count > 0) {
        toast.info(
          `${data.unassigned_count} guest${data.unassigned_count !== 1 ? 's remain' : ' remains'} unassigned due to insufficient capacity`
        )
      }

      setOpen(false)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Failed to auto-assign guests'
      toast.error(message)
    },
  })

  const handleAutoAssign = () => {
    autoAssignMutation.mutate()
  }

  if (unassignedCount === 0) {
    return null
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          disabled={disabled || autoAssignMutation.isPending}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Auto-Assign ({unassignedCount})
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Auto-Assign Guests to Tables?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              This will automatically assign {unassignedCount} unassigned guest
              {unassignedCount !== 1 ? 's' : ''} to available tables using an
              intelligent algorithm.
            </p>
            <p className="font-medium">The algorithm will:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Keep registration parties together when possible</li>
              <li>Fill tables sequentially for efficient packing</li>
              <li>Prioritize larger parties first</li>
              <li>Split large parties only when necessary</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              You can manually adjust assignments after auto-assignment if needed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={autoAssignMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAutoAssign}
            disabled={autoAssignMutation.isPending}
          >
            {autoAssignMutation.isPending ? 'Assigning...' : 'Auto-Assign Guests'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
