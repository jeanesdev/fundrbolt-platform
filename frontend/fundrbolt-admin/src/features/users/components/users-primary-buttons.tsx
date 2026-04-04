import { Button } from '@/components/ui/button'
import { MailPlus, UploadCloud, UserPlus } from 'lucide-react'
import { useUsers } from './users-provider'

export function UsersPrimaryButtons() {
  const { setOpen } = useUsers()
  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('invite')}
      >
        <span className='hidden sm:inline'>Invite User</span> <MailPlus size={18} />
      </Button>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={() => setOpen('import')}
      >
        <span className='hidden sm:inline'>Import Users</span> <UploadCloud size={18} />
      </Button>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span className='hidden sm:inline'>Add User</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
