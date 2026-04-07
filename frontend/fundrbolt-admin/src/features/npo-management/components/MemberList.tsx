/**
 * MemberList Component
 * Displays current NPO members with role management and removal actions
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { memberApi } from '@/services/npo-service'
import type { MemberRole, NPOMember } from '@/types/npo'
import {
  ArrowUpDown,
  Filter,
  MoreVertical,
  Shield,
  UserCog,
  UserMinus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useViewPreference } from '@/hooks/use-view-preference'
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableViewToggle } from '@/components/data-table/view-toggle'

interface MemberListProps {
  npoId: string
  canManageMembers?: boolean
}

// Role badge colors
const roleColors: Record<MemberRole, string> = {
  admin: 'bg-red-500 text-white',
  co_admin: 'bg-orange-500 text-white',
  auctioneer: 'bg-purple-500 text-white',
  staff: 'bg-blue-500 text-white',
}

// Role labels
const roleLabels: Record<MemberRole, string> = {
  admin: 'Admin',
  co_admin: 'Co-Admin',
  auctioneer: 'Auctioneer',
  staff: 'Staff',
}

type SortKey = 'name' | 'email' | 'role' | 'joined'
type SortDirection = 'asc' | 'desc'

type FilterState = {
  name: string
  email: string
  role: string
}

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'co_admin', label: 'Co-Admin' },
  { value: 'staff', label: 'Staff' },
]

function getMemberName(member: NPOMember): string {
  return (
    member.user_full_name ||
    (member.user_first_name && member.user_last_name
      ? `${member.user_first_name} ${member.user_last_name}`
      : member.user_first_name || member.user_last_name || 'N/A')
  )
}

export function MemberList({
  npoId,
  canManageMembers = false,
}: MemberListProps) {
  const queryClient = useQueryClient()
  const [memberToRemove, setMemberToRemove] = useState<NPOMember | null>(null)
  const [viewMode, setViewMode] = useViewPreference('npo-members')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filters, setFilters] = useState<FilterState>({
    name: '',
    email: '',
    role: '',
  })

  const handleSortChange = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const renderTextHeader = (
    label: string,
    key: SortKey,
    filterKey: keyof FilterState,
    placeholder: string
  ) => (
    <TableHead>
      <div className='flex items-center gap-2'>
        <button
          className='flex items-center gap-2'
          onClick={() => handleSortChange(key)}
          type='button'
        >
          {label}
          <ArrowUpDown className='text-muted-foreground h-3 w-3' />
          {sortKey === key && (
            <span className='text-muted-foreground text-xs'>
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`hover:text-foreground rounded-sm p-1 ${filters[filterKey] ? 'text-primary' : 'text-muted-foreground'}`}
              type='button'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className='px-2 py-2' onClick={(e) => e.stopPropagation()}>
              <Input
                placeholder={placeholder}
                value={filters[filterKey]}
                onChange={(e) => updateFilter(filterKey, e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <DropdownMenuItem
              disabled={!filters[filterKey]}
              onSelect={() => updateFilter(filterKey, '')}
            >
              Clear filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

  const renderOptionHeader = (
    label: string,
    key: SortKey,
    filterKey: keyof FilterState,
    options: Array<{ value: string; label: string }>
  ) => (
    <TableHead>
      <div className='flex items-center gap-2'>
        <button
          className='flex items-center gap-2'
          onClick={() => handleSortChange(key)}
          type='button'
        >
          {label}
          <ArrowUpDown className='text-muted-foreground h-3 w-3' />
          {sortKey === key && (
            <span className='text-muted-foreground text-xs'>
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`hover:text-foreground rounded-sm p-1 ${filters[filterKey] ? 'text-primary' : 'text-muted-foreground'}`}
              type='button'
              aria-label={`Filter ${label}`}
            >
              <Filter className='h-3 w-3' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start' className='w-56'>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={filters[filterKey]}
              onValueChange={(v) => updateFilter(filterKey, v)}
            >
              {options.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!filters[filterKey]}
              onSelect={() => updateFilter(filterKey, '')}
            >
              Clear filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TableHead>
  )

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
      <div className='space-y-4'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='py-8 text-center text-red-500'>
        Failed to load members. Please try again.
      </div>
    )
  }

  const rawMembers = membersResponse?.items || []

  // Client-side filter
  const filteredMembers = rawMembers.filter((m) => {
    const name = getMemberName(m).toLowerCase()
    const email = (m.user_email || '').toLowerCase()
    if (filters.name && !name.includes(filters.name.toLowerCase())) return false
    if (filters.email && !email.includes(filters.email.toLowerCase()))
      return false
    if (filters.role && m.role !== filters.role) return false
    return true
  })

  // Client-side sort
  const members = sortKey
    ? [...filteredMembers].sort((a, b) => {
        let aVal = ''
        let bVal = ''
        if (sortKey === 'name') {
          aVal = getMemberName(a)
          bVal = getMemberName(b)
        } else if (sortKey === 'email') {
          aVal = a.user_email || ''
          bVal = b.user_email || ''
        } else if (sortKey === 'role') {
          aVal = a.role
          bVal = b.role
        } else if (sortKey === 'joined') {
          aVal = a.joined_at || ''
          bVal = b.joined_at || ''
        }
        const cmp = aVal.localeCompare(bVal)
        return sortDirection === 'asc' ? cmp : -cmp
      })
    : filteredMembers

  if (rawMembers.length === 0) {
    return (
      <div className='text-muted-foreground py-8 text-center'>
        No members found. Invite your first team member above.
      </div>
    )
  }

  return (
    <>
      <div className='mb-2 flex justify-end'>
        <DataTableViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      {members.length === 0 && (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          No members match your filters.
        </div>
      )}
      {viewMode === 'card' ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {members.map((member) => {
            const memberName = getMemberName(member)
            return (
              <div key={member.id} className='space-y-2 rounded-md border p-3'>
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>{memberName}</span>
                  {canManageMembers && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant='ghost'
                          size='sm'
                          disabled={member.role === 'admin'}
                        >
                          <MoreVertical className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'admin')}
                          disabled={member.role === 'admin'}
                        >
                          <Shield className='mr-2 h-4 w-4' /> Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'co_admin')}
                          disabled={member.role === 'co_admin'}
                        >
                          <UserCog className='mr-2 h-4 w-4' /> Make Co-Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRoleUpdate(member, 'staff')}
                          disabled={member.role === 'staff'}
                        >
                          <UserCog className='mr-2 h-4 w-4' /> Make Staff
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member)}
                          className='text-red-600'
                        >
                          <UserMinus className='mr-2 h-4 w-4' /> Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-sm'>
                  <dt className='text-muted-foreground'>Email</dt>
                  <dd className='truncate'>{member.user_email}</dd>
                  <dt className='text-muted-foreground'>Role</dt>
                  <dd>
                    <Badge className={roleColors[member.role]}>
                      {roleLabels[member.role]}
                    </Badge>
                  </dd>
                  <dt className='text-muted-foreground'>Joined</dt>
                  <dd>
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString()
                      : 'N/A'}
                  </dd>
                </dl>
              </div>
            )
          })}
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                {renderTextHeader('Name', 'name', 'name', 'Search name...')}
                {renderTextHeader('Email', 'email', 'email', 'Search email...')}
                {renderOptionHeader('Role', 'role', 'role', roleOptions)}
                <TableHead>Joined</TableHead>
                {canManageMembers && (
                  <TableHead className='w-[50px]'></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className='font-medium'>
                    {getMemberName(member)}
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
                            variant='ghost'
                            size='sm'
                            disabled={member.role === 'admin'}
                          >
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => handleRoleUpdate(member, 'admin')}
                            disabled={member.role === 'admin'}
                          >
                            <Shield className='mr-2 h-4 w-4' />
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRoleUpdate(member, 'co_admin')}
                            disabled={member.role === 'co_admin'}
                          >
                            <UserCog className='mr-2 h-4 w-4' />
                            Make Co-Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRoleUpdate(member, 'staff')}
                            disabled={member.role === 'staff'}
                          >
                            <UserCog className='mr-2 h-4 w-4' />
                            Make Staff
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveMember(member)}
                            className='text-red-600'
                          >
                            <UserMinus className='mr-2 h-4 w-4' />
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
      )}

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user_full_name}{' '}
              from the organization? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className='bg-red-600 hover:bg-red-700'
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
