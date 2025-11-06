/**
 * MemberList Component
 * Displays current NPO members with role management and removal actions
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { memberApi } from '@/services/npo-service'
import type { MemberRole, NPOMember } from '@/types/npo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical, Shield, UserCog, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface MemberListProps {
  npoId: string
  canManageMembers?: boolean
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

export function MemberList({ npoId, canManageMembers = false }: MemberListProps) {
  const queryClient = useQueryClient()
  const [memberToRemove, setMemberToRemove] = useState<NPOMember | null>(null)

  // Fetch members
  const {
    data: membersResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['npo-members', npoId],
    queryFn: () => memberApi.listMembers({ npo_id: npoId, status: 'active' }),
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      memberApi.updateMemberRole(npoId, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npo-members', npoId] })
      toast.success('Member role updated successfully')
    },
    onError: () => {
      toast.error('Failed to update member role')
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => memberApi.removeMember(npoId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['npo-members', npoId] })
      toast.success('Member removed successfully')
      setMemberToRemove(null)
    },
    onError: () => {
      toast.error('Failed to remove member')
    },
  })

  const handleRoleUpdate = (member: NPOMember, newRole: MemberRole) => {
    if (member.role === 'admin') {
      toast.error('Cannot change primary admin role')
      return
    }
    updateRoleMutation.mutate({ memberId: member.id, role: newRole })
  }

  const handleRemoveMember = (member: NPOMember) => {
    if (member.role === 'admin') {
      toast.error('Cannot remove primary admin')
      return
    }
    setMemberToRemove(member)
  }

  const confirmRemove = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.id)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load members. Please try again.
      </div>
    )
  }

  const members = membersResponse?.items || []

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No members found. Invite your first team member above.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManageMembers && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.user_full_name ||
                    (member.user_first_name && member.user_last_name
                      ? `${member.user_first_name} ${member.user_last_name}`
                      : member.user_first_name || member.user_last_name || 'N/A')}
                </TableCell>
                <TableCell>{member.user_email}</TableCell>
                <TableCell>
                  <Badge className={roleColors[member.role]}>
                    {roleLabels[member.role]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.joined_at
                    ? new Date(member.joined_at).toLocaleDateString()
                    : 'N/A'}
                </TableCell>
                {canManageMembers && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={member.role === 'admin'}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'admin')}
                          disabled={member.role === 'admin'}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'co_admin')}
                          disabled={member.role === 'co_admin'}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Make Co-Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'staff')}
                          disabled={member.role === 'staff'}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Make Staff
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member)}
                          className="text-red-600"
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user_full_name} from the
              organization? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
