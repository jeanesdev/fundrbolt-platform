import { DebugSpoofSheet } from '@/components/debug-spoof-sheet'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog-state'
import { useAuthStore } from '@/stores/auth-store'
import { useDebugSpoofStore } from '@/stores/debug-spoof-store'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [spoofSheetOpen, setSpoofSheetOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const getProfilePictureUrl = useAuthStore((state) => state.getProfilePictureUrl)
  const spoofedUser = useDebugSpoofStore((state) => state.spoofedUser)
  const timeBaseSpoofMs = useDebugSpoofStore((state) => state.timeBaseSpoofMs)
  const isSuperAdmin = user?.role === 'super_admin'

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : 'U'

  const profilePictureUrl = getProfilePictureUrl()

  const isSpoofActive = isSuperAdmin && (!!spoofedUser || timeBaseSpoofMs !== null)

  return (
    <>
      <DropdownMenu modal={false} open={!!menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
            <Avatar className='h-8 w-8'>
              <AvatarImage src={profilePictureUrl || undefined} alt={user?.email || 'User'} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {isSpoofActive && (
              <span className='absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white animate-pulse' />
            )}
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
              {spoofedUser?.label && (
                <p className='text-amber-600 text-xs leading-none'>Spoofing: {spoofedUser.label}</p>
              )}
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
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false)
                  // Small delay so dropdown closes before sheet opens
                  setTimeout(() => setSpoofSheetOpen(true), 150)
                }}
              >
                Debug Tools
                {isSpoofActive && (
                  <span className='ml-auto h-2 w-2 rounded-full bg-amber-400' />
                )}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen(true)}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />

      {isSuperAdmin && (
        <DebugSpoofSheet open={spoofSheetOpen} onOpenChange={setSpoofSheetOpen} />
      )}
    </>
  )
}
