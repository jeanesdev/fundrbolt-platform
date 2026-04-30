import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { donateNowApi, SUPPORT_WALL_PAGE_SIZE } from '@/lib/api/donateNow'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SupportWallEntry } from './SupportWallEntry'

interface SupportWallProps {
  npoSlug: string
}

export function SupportWall({ npoSlug }: SupportWallProps) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['support-wall', npoSlug, page],
    queryFn: () =>
      donateNowApi
        .getSupportWall(npoSlug, page, SUPPORT_WALL_PAGE_SIZE)
        .then((r) => r.data),
  })

  const totalPages = data?.pages ?? 0
  const canGoPrevious = page > 1
  const canGoNext = totalPages > 0 && page < totalPages

  return (
    <section
      className='space-y-4 rounded-xl border p-4'
      style={{
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.22)',
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
      }}
    >
      <h2 className='text-lg font-semibold'>Support Wall</h2>
      {isLoading ? (
        <p
          className='text-sm'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          Loading support wall...
        </p>
      ) : !data || data.entries.length === 0 ? (
        <p
          className='text-sm'
          style={{ color: 'var(--event-text-muted-on-background, #4B5563)' }}
        >
          Be the first to donate!
        </p>
      ) : (
        <>
          <ScrollArea className='h-[26rem] pr-4'>
            <div className='space-y-3'>
              {data.entries.map((entry) => (
                <SupportWallEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </ScrollArea>

          <div className='flex items-center justify-between gap-3 border-t pt-4'>
            <p
              className='text-sm'
              style={{
                color: 'var(--event-text-muted-on-background, #4B5563)',
              }}
            >
              Showing page {page} of {Math.max(totalPages, 1)}
            </p>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((current) => current - 1)}
                disabled={!canGoPrevious}
              >
                <ChevronLeft className='mr-1 h-4 w-4' />
                Previous
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setPage((current) => current + 1)}
                disabled={!canGoNext}
              >
                Next
                <ChevronRight className='ml-1 h-4 w-4' />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
