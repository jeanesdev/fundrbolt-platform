/**
 * PendingInvitations Component
 * Displays list of pending member invitations with status and actions
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error-utils'
import { memberApi } from '@/services/npo-service'
import type { MemberRole, PendingInvitation } from '@/types/npo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Mail, MailPlus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface PendingInvitationsProps {
  npoId: string
}

// Role badge colors
const roleColors: Record<MemberRole, string> = {
  admin: 'bg-red-500 text-white',
  co_admin: 'bg-orange-500 text-white',
  staff: 'bg-blue-500 text-white',
}

// Role labels
const roleLabels: Record<MemberRole, string> = {
  admin: 'Admin',
  co_admin: 'Co-Admin',
  staff: 'Staff',
}

export function PendingInvitations({ npoId }: PendingInvitationsProps) {
  const queryClient = useQueryClient()
  const [invitationToRevoke, setInvitationToRevoke] = useState<PendingInvitation | null>(
    null
  )

  // Fetch pending invitations
  const {
    data: invitations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['npo-invitations', npoId],
    queryFn: () => memberApi.listPendingInvitations(npoId),
  })

  // Revoke invitation mutation
  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => memberApi.revokeInvitation(npoId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npo-invitations', npoId] })
      toast.success('Invitation revoked successfully')
      setInvitationToRevoke(null)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'Failed to revoke invitation')
      toast.error(message)
    },
  })

  // Resend invitation mutation
  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => memberApi.resendInvitation(npoId, invitationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['npo-invitations', npoId] })
      toast.success(`Invitation resent to ${data.email}`)
      const expiresAt = new Date(data.expires_at)
      toast.info(`New expiry: ${expiresAt.toLocaleDateString()}`)
    },
    onError: (error: unknown) => {
      const message = getErrorMessage(error, 'Failed to resend invitation')
      toast.error(message)
    },
  })

  const handleRevoke = (invitation: PendingInvitation) => {
    setInvitationToRevoke(invitation)
  }

  const handleResend = (invitationId: string) => {
    resendMutation.mutate(invitationId)
  }

  const confirmRevoke = () => {
    if (invitationToRevoke) {
      revokeMutation.mutate(invitationToRevoke.id)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            Failed to load invitations. Please try again.
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!invitations || invitations.length === 0) {
    return null // Don't show the card if there are no pending invitations
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          Invitations sent but not yet accepted ({invitations.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const expiresAt = new Date(invitation.expires_at)
                const now = new Date()
                const hoursUntilExpiry = Math.floor(
                  (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
                )
                const isExpiringSoon = hoursUntilExpiry < 24 && hoursUntilExpiry > 0

                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleColors[invitation.role as MemberRole]}>
                        {roleLabels[invitation.role as MemberRole]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span
                          className={isExpiringSoon ? 'text-orange-600 font-medium' : ''}
                        >
                          {expiresAt.toLocaleDateString()}
                          {isExpiringSoon && (
                            <span className="text-xs ml-1">
                              ({hoursUntilExpiry}h left)
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResend(invitation.id)}
                          disabled={resendMutation.isPending || revokeMutation.isPending}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Resend invitation"
                        >
                          <MailPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(invitation)}
                          disabled={resendMutation.isPending || revokeMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Revoke invitation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Revoke confirmation dialog */}
      <AlertDialog
        open={!!invitationToRevoke}
        onOpenChange={(open) => !open && setInvitationToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{' '}
              <strong>{invitationToRevoke?.email}</strong>? The invitation link will no
              longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-red-600 hover:bg-red-700"
            >
              Revoke Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
