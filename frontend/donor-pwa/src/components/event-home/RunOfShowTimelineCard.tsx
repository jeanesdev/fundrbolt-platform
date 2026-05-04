/**
 * RunOfShowTimelineCard
 *
 * Collapsible timeline card for the Home tab showing the donor-visible
 * run-of-show items. Hidden entirely when there are no items.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, Clock } from 'lucide-react'
import type { DonorRunOfShowItem } from '@/types/run-of-show'

interface RunOfShowTimelineCardProps {
  items: DonorRunOfShowItem[]
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function RunOfShowTimelineCard({ items }: RunOfShowTimelineCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  // The "next up" item is the first uncompleted item
  const nextItemIndex = items.findIndex((item) => !item.is_complete)

  return (
    <div
      className='overflow-hidden rounded-2xl border'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.2)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      {/* Header / toggle button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className='flex w-full items-center justify-between px-4 py-3'
        aria-expanded={expanded}
      >
        <div className='flex items-center gap-2'>
          <Clock
            className='h-4 w-4 shrink-0'
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          />
          <span
            className='text-sm font-bold'
            style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
          >
            Event Program
          </span>
          <span className='text-muted-foreground text-xs'>
            ({items.length} item{items.length === 1 ? '' : 's'})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className='text-muted-foreground h-4 w-4 shrink-0' />
        ) : (
          <ChevronDown className='text-muted-foreground h-4 w-4 shrink-0' />
        )}
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className='border-t px-4 pb-4 pt-2' style={{ borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.1)' }}>
          <ol className='space-y-3'>
            {items.map((item, index) => {
              const isNextUp = index === nextItemIndex
              const isComplete = item.is_complete

              return (
                <li key={item.id} className='flex items-start gap-3'>
                  {/* Timeline dot */}
                  <div className='mt-0.5 flex flex-col items-center'>
                    <div
                      className='h-2.5 w-2.5 shrink-0 rounded-full'
                      style={{
                        backgroundColor: isComplete
                          ? 'rgb(var(--event-primary, 59, 130, 246) / 0.3)'
                          : isNextUp
                            ? 'rgb(var(--event-primary, 59, 130, 246))'
                            : 'rgb(var(--event-primary, 59, 130, 246) / 0.5)',
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-baseline gap-x-2'>
                      <span
                        className={[
                          'text-xs tabular-nums',
                          isComplete ? 'line-through opacity-50' : '',
                          isNextUp ? 'font-bold' : 'text-muted-foreground',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={
                          isNextUp && !isComplete
                            ? { color: 'rgb(var(--event-primary, 59, 130, 246))' }
                            : undefined
                        }
                      >
                        {formatTime(item.scheduled_time)}
                      </span>
                      <span
                        className={[
                          'text-sm',
                          isComplete
                            ? 'line-through opacity-50'
                            : isNextUp
                              ? 'font-semibold'
                              : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={
                          isNextUp && !isComplete
                            ? {
                                color:
                                  'var(--event-text-on-background, #374151)',
                              }
                            : undefined
                        }
                      >
                        {item.title}
                      </span>
                      {isNextUp && !isComplete && (
                        <span
                          className='rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white'
                          style={{
                            backgroundColor:
                              'rgb(var(--event-primary, 59, 130, 246))',
                          }}
                        >
                          Up Next
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
