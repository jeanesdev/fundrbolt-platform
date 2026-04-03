/**
 * Sidebar-Free Layout
 *
 * A clean, full-width layout without sidebar for immersive pages like
 * the event homepage. Uses full viewport width with proper padding
 * for an app-like experience.
 *
 * Navigation is provided via:
 * - EventSwitcher component (in-page dropdown for switching events)
 * - ProfileDropdown in header
 * - Back navigation
 */
import { LegalFooter } from '@/components/legal/legal-footer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SkipToMain } from '@/components/skip-to-main'
import { Button } from '@/components/ui/button'
import { SearchProvider } from '@/context/search-provider'
import { useAuth } from '@/hooks/use-auth'
import { getRegisteredEventsWithBranding } from '@/lib/api/registrations'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { colors, LogoWhiteGold } from '@fundrbolt/shared/assets'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Home } from 'lucide-react'
import { useEffect, useState } from 'react'

type SidebarFreeLayoutProps = {
  children?: React.ReactNode
  /** Show a back button in header */
  showBackButton?: boolean
  /** Show home button in header */
  showHomeButton?: boolean
  /** Header visual treatment */
  headerVariant?: 'default' | 'brand'
  /** Custom header content (replaces default) */
  headerContent?: React.ReactNode
}

export function SidebarFreeLayout({
  children,
  showBackButton = false,
  showHomeButton = true,
  headerVariant = 'default',
  headerContent,
}: SidebarFreeLayoutProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const restoreUserFromRefreshToken = useAuthStore(
    (state) => state.restoreUserFromRefreshToken
  )
  const [isRestoring, setIsRestoring] = useState(true)

  // Restore user from refresh token on mount if needed
  useEffect(() => {
    const restore = async () => {
      const currentUser = useAuthStore.getState().user
      if (!currentUser) {
        try {
          await restoreUserFromRefreshToken()
        } catch {
          // Auth guards handle unauthenticated state if refresh restoration fails.
        }
      }
      setIsRestoring(false)
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  // Prefetch user's events for navigation (same as authenticated-layout)
  useQuery({
    queryKey: ['registrations', 'events-with-branding'],
    queryFn: getRegisteredEventsWithBranding,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!user && !isRestoring,
  })

  // Show loading while restoring user
  if (isRestoring) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <SearchProvider>
      <SkipToMain />
      <div className='flex min-h-screen flex-col'>
        {/* Compact header - no sidebar trigger */}
        <header
          className={cn(
            'sticky top-0 z-50 border-b pt-safe-top',
            headerVariant === 'brand'
              ? 'min-h-16 border-white/10 text-white'
              : 'bg-background/95 supports-[backdrop-filter]:bg-background/60 min-h-14 backdrop-blur'
          )}
          style={
            headerVariant === 'brand'
              ? { backgroundColor: colors.primary.navy }
              : undefined
          }
        >
          <div className='flex h-full items-center justify-between px-4'>
            {/* Left side - navigation buttons */}
            <div className='flex items-center gap-2'>
              {showBackButton && (
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => navigate({ to: '..' })}
                  aria-label='Go back'
                  className={cn(
                    headerVariant === 'brand' &&
                    'text-white hover:bg-white/10 hover:text-white'
                  )}
                >
                  <ArrowLeft className='h-5 w-5' />
                </Button>
              )}
              {showHomeButton && (
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => navigate({ to: '/home' })}
                  aria-label='Go to home'
                  className={cn(
                    headerVariant === 'brand' &&
                    'text-white hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Home className='h-5 w-5' />
                </Button>
              )}
            </div>

            {headerVariant === 'brand' && (
              <div className='pointer-events-none absolute inset-x-0 flex justify-center px-16'>
                <img
                  src={LogoWhiteGold}
                  alt='FundrBolt'
                  className='h-10 max-w-full'
                />
              </div>
            )}

            {/* Center/Right - custom header content or defaults */}
            {headerContent ? (
              <div className='flex flex-1 items-center justify-end gap-4'>
                {headerContent}
              </div>
            ) : headerVariant === 'brand' ? (
              <div className='ml-auto flex items-center gap-4'>
                <ProfileDropdown />
              </div>
            ) : (
              <div className='flex items-center gap-4'>
                <Search />
                <ProfileDropdown />
              </div>
            )}
          </div>
        </header>

        {/* Main content - full width, proper mobile padding */}
        <main
          id='main-content'
          className={cn(
            'flex-1',
            // Full width with responsive padding
            'w-full px-4 py-4',
            'sm:px-6 sm:py-6',
            'lg:px-8'
          )}
        >
          {children ?? <Outlet />}
        </main>

        {/* Footer */}
        <LegalFooter />
      </div>
    </SearchProvider>
  )
}
