import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { type Row } from '@tanstack/react-table'
import {
  Eye,
  KeyRound,
  MailCheck,
  Shield,
  UserCheck,
  UserPen,
  UserX,
} from 'lucide-react'
import { type User } from '../data/schema'
import { useActivateUser, useVerifyUserEmail } from '../hooks/use-users'
import { useUsers } from './users-provider'

type DataTableRowActionsProps = {
  row: Row<User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { setOpen, setCurrentRow } = useUsers()
  const activateUser = useActivateUser()
  const verifyEmail = useVerifyUserEmail()
  const user = row.original

  const handleToggleActive = async () => {
    try {
      await activateUser.mutateAsync({
        userId: user.id,
        data: { is_active: !user.is_active },
      })
    } catch {
      // Error handling is done in the mutation hook
    }
  }

  const handleVerifyEmail = async () => {
    try {
      await verifyEmail.mutateAsync(user.id)
    } catch {
      // Error handling is done in the mutation hook
    }
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
          >
            <DotsHorizontalIcon className='h-4 w-4' />
            <span className='sr-only'>Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[160px]'>
          <DropdownMenuItem asChild>
            <Link
              to='/users/$userId'
              params={{ userId: user.id }}
              className='cursor-pointer'
            >
              View Details
              <DropdownMenuShortcut>
                <Eye size={16} />
              </DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(user)
              setOpen('edit')
            }}
          >
            Edit
            <DropdownMenuShortcut>
              <UserPen size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(user)
              setOpen('role')
            }}
          >
            Change Role
            <DropdownMenuShortcut>
              <Shield size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(user)
              setOpen('resetPassword')
            }}
          >
            Reset Password
            <DropdownMenuShortcut>
              <KeyRound size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleActive}>
            {user.is_active ? 'Deactivate' : 'Activate'}
            <DropdownMenuShortcut>
              {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          {!user.email_verified && (
            <DropdownMenuItem onClick={handleVerifyEmail}>
              Verify Email
              <DropdownMenuShortcut>
                <MailCheck size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
