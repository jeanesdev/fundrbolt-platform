/**
 * Ticket Listing Layout — /events/$slug/tickets
 * Renders the ticket listing index route and checkout child routes.
 * Provides a sticky header with back, home, and profile navigation.
 */
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { hasValidRefreshToken } from '@/lib/storage/tokens'
import { useAuthStore } from '@/stores/auth-store'
import { colors, LogoWhiteGold } from '@fundrbolt/shared/assets'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Home } from 'lucide-react'

export const Route = createFileRoute('/events/$slug/tickets')({
  component: TicketListingPage,
})

function TicketListingPage() {
  const navigate = useNavigate()
  const { slug } = Route.useParams()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasRefreshToken = hasValidRefreshToken()
  const showProfile = isAuthenticated || hasRefreshToken

  return (
    <div className='flex min-h-screen flex-col'>
      <header
        className='sticky top-0 z-50 min-h-16 border-b border-white/10 pt-safe-top text-white'
        style={{ backgroundColor: colors.primary.navy }}
      >
        <div className='flex h-full items-center justify-between px-4'>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() =>
                navigate({ to: '/events/$slug', params: { slug } })
              }
              aria-label='Back to event'
              className='text-white hover:bg-white/10 hover:text-white'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => navigate({ to: '/home' })}
              aria-label='Go to home'
              className='text-white hover:bg-white/10 hover:text-white'
            >
              <Home className='h-5 w-5' />
            </Button>
          </div>

          <div className='pointer-events-none absolute inset-x-0 flex items-center justify-center px-16'>
            <img
              src={LogoWhiteGold}
              alt='FundrBolt'
              className='h-8 w-auto shrink-0'
            />
          </div>

          {showProfile && (
            <div className='ml-auto flex items-center gap-4'>
              <ProfileDropdown />
            </div>
          )}
        </div>
      </header>

      <main className='flex-1'>
        <Outlet />
      </main>
    </div>
  )
}
