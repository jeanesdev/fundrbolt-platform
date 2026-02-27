/**
 * BottomTabNav — Native-app-style bottom navigation for the Donor PWA
 *
 * Four tabs:  Home | Bid | Watching | My Seat
 * Active tab uses the event primary brand colour.
 * Supports a badge count on any tab.
 */

import { cn } from '@/lib/utils'
import { Gavel, Home, MapPin, Eye } from 'lucide-react'

export type DonorTab = 'home' | 'auction' | 'watchlist' | 'seat'

interface TabConfig {
  id: DonorTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'auction', label: 'Bid', icon: Gavel },
  { id: 'watchlist', label: 'Watching', icon: Eye },
  { id: 'seat', label: 'My Seat', icon: MapPin },
]

export interface BottomTabNavProps {
  activeTab: DonorTab
  onTabChange: (tab: DonorTab) => void
  /** Badge counts keyed by tab id */
  badges?: Partial<Record<DonorTab, number>>
}

export function BottomTabNav({
  activeTab,
  onTabChange,
  badges = {},
}: BottomTabNavProps) {
  return (
    <nav
      className='fixed bottom-0 left-0 right-0 z-50 border-t'
      style={{
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className='flex items-stretch h-16'>
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const badgeCount = badges[tab.id] ?? 0
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2',
                'transition-all duration-200 active:scale-95',
                'relative focus:outline-none',
                isActive ? 'scale-105' : 'opacity-60 hover:opacity-80'
              )}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className='absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full'
                  style={{
                    backgroundColor: `rgb(var(--event-primary, 59, 130, 246))`,
                  }}
                />
              )}

              {/* Icon with optional badge */}
              <span className='relative'>
                <Icon
                  className={cn(
                    'transition-all duration-200',
                    isActive ? 'h-6 w-6' : 'h-5 w-5'
                  )}
                  style={{
                    color: isActive
                      ? `rgb(var(--event-primary, 59, 130, 246))`
                      : 'var(--event-text-on-background, #000000)',
                  }}
                />
                {badgeCount > 0 && (
                  <span
                    className='absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none text-white'
                    style={{
                      backgroundColor: 'rgb(239, 68, 68)',
                    }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  isActive ? 'font-semibold' : ''
                )}
                style={{
                  color: isActive
                    ? `rgb(var(--event-primary, 59, 130, 246))`
                    : 'var(--event-text-on-background, #000000)',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
