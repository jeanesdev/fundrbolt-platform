import { BottomNav } from '@/components/layout/bottom-nav'
import { useTabSwipe } from '@/hooks/use-tab-swipe'
import { useEventContextStore } from '@/stores/event-context-store'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

const SETTINGS_TABS = [
  '/settings',
  '/settings/password',
  '/settings/notifications',
  '/settings/consent',
  '/settings/payment',
] as const

export function Settings() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const selectedEventSlug = useEventContextStore((s) => s.selectedEventSlug)

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
      <header className='bg-background/95 sticky top-0 z-50 flex min-h-14 items-center border-b pt-safe-top backdrop-blur'>
        <div className='flex w-full items-center px-4'>
          <button
            onClick={() =>
              void navigate({
                to: selectedEventSlug
                  ? '/events/$slug'
                  : '/home',
                params: selectedEventSlug
                  ? { slug: selectedEventSlug }
                  : undefined,
              })
            }
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
