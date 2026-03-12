import { BottomNav } from '@/components/layout/bottom-nav'
import { useTabSwipe } from '@/hooks/use-tab-swipe'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

const SETTINGS_TABS = [
  '/settings',
  '/settings/password',
  '/settings/consent',
  '/settings/payment',
] as const

export function Settings() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })

  const currentIndex = SETTINGS_TABS.indexOf(
    pathname as (typeof SETTINGS_TABS)[number]
  )

  const { onTouchStart, onTouchMove, onTouchEnd } = useTabSwipe({
    onSwipeLeft: () => {
      if (currentIndex < SETTINGS_TABS.length - 1) {
        void navigate({ to: SETTINGS_TABS[currentIndex + 1] })
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        void navigate({ to: SETTINGS_TABS[currentIndex - 1] })
      } else {
        // Swipe right from first settings tab → go back to events
        void navigate({ to: '/home' })
      }
    },
  })

  return (
    <div className='bg-background flex min-h-screen flex-col'>
      {/* Compact header with back button */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex h-14 items-center border-b backdrop-blur'>
        <div className='flex w-full items-center px-4'>
          <button
            onClick={() => void navigate({ to: '/home' })}
            className='text-muted-foreground hover:text-foreground flex items-center gap-1'
            aria-label='Back to event'
          >
            <ArrowLeft className='h-5 w-5' />
            <span className='text-sm font-medium'>Event</span>
          </button>
          <h1 className='ml-3 text-base font-semibold'>Settings</h1>
        </div>
      </header>

      {/* Swipeable content area */}
      <main
        className='flex-1 overflow-y-auto px-4 py-4 pb-20'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
