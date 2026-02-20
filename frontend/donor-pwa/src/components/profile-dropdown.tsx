import { SignOutDialog } from '@/components/sign-out-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog-state'
import apiClient from '@/lib/axios'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

interface UserOption {
  id: string
  first_name: string
  last_name: string
  email: string
}

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore((state) => state.getProfilePictureUrl)
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const getEffectiveNowMs = useDebugSpoofStore((state) => state.getEffectiveNowMs)
  const setSpoofedTime = useDebugSpoofStore((state) => state.setSpoofedTime)
  const clearSpoofedTime = useDebugSpoofStore((state) => state.clearSpoofedTime)
  const setSpoofedUser = useDebugSpoofStore((state) => state.setSpoofedUser)
  const clearSpoofedUser = useDebugSpoofStore((state) => state.clearSpoofedUser)

  const isSuperAdmin = user?.role === 'super_admin'

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['debug', 'users', 'spoof-list'],
    queryFn: async () => {
      const response = await apiClient.get('/users', {
        params: {
          page: 1,
          per_page: 50,
        },
      })
      return response.data as { items: UserOption[] }
    },
    enabled: isSuperAdmin && !!menuOpen,
    staleTime: 60_000,
  })

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

  const handleSpoofTimePrompt = () => {
    const currentValue =
      timeBaseSpoofMs !== null
        ? new Date(getEffectiveNowMs()).toISOString().slice(0, 16)
        : ''

    const input = window.prompt(
      'Enter spoofed date/time (ISO or YYYY-MM-DDTHH:mm). Leave blank to clear.',
      currentValue
    )

    if (input === null) {
      return
    }

    const trimmed = input.trim()
    if (!trimmed) {
      clearSpoofedTime()
      toast.success('Time spoof cleared')
      return
    }

    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) {
      toast.error('Invalid date/time format')
      return
    }

    setSpoofedTime(parsed)
    toast.success('Time spoof enabled')
  }

  const handleSpoofUserByIdPrompt = () => {
    const input = window.prompt('Enter user ID to spoof. Leave blank to clear.', spoofedUser?.id || '')

    if (input === null) {
      return
    }

    const trimmed = input.trim()
    if (!trimmed) {
      clearSpoofedUser()
      toast.success('User spoof cleared')
      return
    }

    setSpoofedUser(trimmed, trimmed)
    toast.success('User spoof enabled')
  }

  return (
    <>
      <DropdownMenu modal={false} open={!!menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={profilePictureUrl || undefined} alt={user?.email || 'User'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>
                {user ? `${user.first_name} ${user.last_name}` : 'User'}
              </p>
              <p className='text-muted-foreground text-xs leading-none'>
                {user?.email || 'Not logged in'}
              </p>
              {(spoofedUser || timeBaseSpoofMs !== null) && (
                <p className='text-amber-600 text-xs leading-none'>
                  Debug spoof active
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/settings'>Profile</Link>
          </DropdownMenuItem>
          {isSuperAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Debug Tools</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleSpoofTimePrompt}>
                {timeBaseSpoofMs !== null ? 'Update Spoof Time' : 'Spoof Time'}
              </DropdownMenuItem>
              {timeBaseSpoofMs !== null && (
                <DropdownMenuItem onClick={clearSpoofedTime}>
                  Clear Spoof Time
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Spoof User</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className='w-72'>
                  <DropdownMenuItem onClick={handleSpoofUserByIdPrompt}>
                    Enter User ID...
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={spoofedUser?.id || '__none__'}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        clearSpoofedUser()
                        return
                      }
                      const match = usersData?.items?.find((candidate) => candidate.id === value)
                      if (!match) return
                      setSpoofedUser(value, `${match.first_name} ${match.last_name}`.trim())
                    }}
                  >
                    <DropdownMenuRadioItem value='__none__'>No Spoof User</DropdownMenuRadioItem>
                    {usersLoading && (
                      <DropdownMenuItem disabled>Loading users...</DropdownMenuItem>
                    )}
                    {!usersLoading &&
                      usersData?.items?.map((candidate) => (
                        <DropdownMenuRadioItem key={candidate.id} value={candidate.id}>
                          {candidate.first_name} {candidate.last_name} ({candidate.email})
                        </DropdownMenuRadioItem>
                      ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
