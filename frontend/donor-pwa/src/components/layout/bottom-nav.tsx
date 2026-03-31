/**
 * BottomNav
 *
 * Mobile-first bottom navigation bar for authenticated non-event pages.
 * Direct tabs: Profile | Password | Privacy | Payment | Sign Out
 * Events navigation is handled by a top back button in the layout header.
 */
import { SignOutDialog } from '@/components/sign-out-dialog'
import useDialogState from '@/hooks/use-dialog-state'
import { Link, useLocation } from '@tanstack/react-router'
import { Bell, CreditCard, KeyRound, LogOut, Shield, UserCog } from 'lucide-react'

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
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'
        }`}
    >
      <Icon className='h-6 w-6' />
      <span>{label}</span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const [signOutOpen, setSignOutOpen] = useDialogState()

  return (
    <>
      <nav
        className='bg-background fixed bottom-0 left-0 right-0 z-50 flex h-20 items-stretch border-t'
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
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
          to='/settings/notifications'
          icon={Bell}
          label='Alerts'
          isActive={pathname === '/settings/notifications'}
        />
        <NavTab
          to='/settings/consent'
          icon={Shield}
          label='Privacy'
          isActive={pathname === '/settings/consent'}
        />
        <NavTab
          to='/settings/payment'
          icon={CreditCard}
          label='Payment'
          isActive={pathname === '/settings/payment'}
        />

        <button
          className='flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors'
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
