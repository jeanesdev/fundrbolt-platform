/**
 * SettingsBottomNav
 *
 * Mobile bottom navigation bar for settings pages in the admin PWA.
 */
import { Link, useLocation } from '@tanstack/react-router'
import { KeyRound, LogOut, Shield, UserCog } from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { SignOutDialog } from '@/components/sign-out-dialog'

function NavTab({
  to,
  icon: Icon,
  label,
  isActive,
}: {
  to: string
  icon: React.ElementType
  label: string
  isActive: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
        isActive ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      <Icon className='h-5 w-5' />
      <span>{label}</span>
    </Link>
  )
}

export function SettingsBottomNav() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const [signOutOpen, setSignOutOpen] = useDialogState()

  return (
    <>
      <nav className='bg-background fixed right-0 bottom-0 left-0 z-50 flex h-16 items-stretch border-t'>
        <NavTab
          to='/settings'
          icon={UserCog}
          label='Profile'
          isActive={pathname === '/settings'}
        />
        <NavTab
          to='/settings/password'
          icon={KeyRound}
          label='Password'
          isActive={pathname === '/settings/password'}
        />
        <NavTab
          to='/settings/consent'
          icon={Shield}
          label='Privacy'
          isActive={pathname === '/settings/consent'}
        />

        <button
          className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors'
          onClick={() => setSignOutOpen(true)}
          aria-label='Sign out'
        >
          <LogOut className='h-5 w-5' />
          <span>Sign Out</span>
        </button>
      </nav>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}
