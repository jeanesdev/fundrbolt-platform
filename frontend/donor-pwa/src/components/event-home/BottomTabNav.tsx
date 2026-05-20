/**
 * BottomTabNav — Native-app-style bottom navigation for the Donor PWA
 *
 * Three tabs:  Home | Bid | My Info
 * Active tab uses the event primary brand colour.
 * Supports a badge count on any tab.
 */
import { cn } from '@/lib/utils'
import { Heart, PartyPopper, Ticket } from 'lucide-react'

export type DonorTab = 'home' | 'auction' | 'seat'

interface TabConfig {
  id: DonorTab
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

const TABS: TabConfig[] = [
  { id: 'home', label: 'Our Cause', icon: Heart },
  { id: 'auction', label: 'Win it', icon: PartyPopper },
  { id: 'seat', label: 'My Event', icon: Ticket },
]

export interface BottomTabNavProps {
  activeTab: DonorTab
  onTabChange: (tab: DonorTab) => void
  onTabIntent?: (tab: DonorTab) => void
  /** Badge counts keyed by tab id */
  badges?: Partial<Record<DonorTab, number>>
  /** Optional subset of tabs to display; defaults to all tabs */
  visibleTabs?: DonorTab[]
}

export function BottomTabNav({
  activeTab,
  onTabChange,
  onTabIntent,
  badges = {},
  visibleTabs,
}: BottomTabNavProps) {
  const tabs = visibleTabs
    ? TABS.filter((t) => visibleTabs.includes(t.id))
    : TABS
  return (
    <nav
      className='fixed right-0 bottom-0 left-0 z-50 border-t'
      style={{
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.15)',
        boxShadow: '0 -1px 4px rgb(0 0 0 / 0.08)',
        paddingBottom: 'var(--bottom-safe-area, 0px)',
      }}
    >
      <div className='flex h-20 items-stretch'>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const badgeCount = badges[tab.id] ?? 0
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              onMouseEnter={() => onTabIntent?.(tab.id)}
              onFocus={() => onTabIntent?.(tab.id)}
              onTouchStart={() => onTabIntent?.(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-3',
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
                  className='absolute top-0 right-1/4 left-1/4 h-0.5 rounded-full'
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
                    isActive ? 'h-7 w-7' : 'h-6 w-6'
                  )}
                  style={{
                    color: isActive
                      ? `rgb(var(--event-primary, 59, 130, 246))`
                      : 'var(--event-text-on-background, #000000)',
                  }}
                />
                {badgeCount > 0 && (
                  <span
                    className='absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] leading-none font-bold text-white'
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
                  'text-xs font-medium transition-all duration-200',
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
