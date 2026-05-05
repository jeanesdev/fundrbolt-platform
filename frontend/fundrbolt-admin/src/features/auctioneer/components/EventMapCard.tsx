/**
 * EventMapCard — Auctioneer-facing event map preview card.
 * Shows a thumbnail of the seating layout image; clicking opens fullscreen.
 */
import { useState } from 'react'
import { ImageIcon, Map, Maximize2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface EventMapCardProps {
  layoutImageUrl?: string | null
}

export function EventMapCard({ layoutImageUrl }: EventMapCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card
        className={`flex h-full flex-col ${layoutImageUrl ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (layoutImageUrl) setOpen(true)
        }}
      >
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base font-semibold'>
            <Map className='text-primary h-5 w-5' />
            Event Map
            {layoutImageUrl && (
              <Maximize2 className='text-muted-foreground ml-auto h-4 w-4' />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 items-center justify-center p-0 px-3 pb-3'>
          {layoutImageUrl ? (
            <div className='bg-muted/30 relative flex h-40 w-full items-center justify-center overflow-hidden rounded-md border'>
              <img
                src={layoutImageUrl}
                alt='Event map'
                className='max-h-full max-w-full object-contain'
              />
              <div className='bg-background/70 absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100'>
                <span className='text-sm font-medium'>View fullscreen</span>
              </div>
            </div>
          ) : (
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-6'>
              <ImageIcon className='h-10 w-10 opacity-30' />
              <p className='text-xs'>No event map uploaded</p>
            </div>
          )}
        </CardContent>
      </Card>

      {layoutImageUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className='flex h-[90dvh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0'
            showCloseButton={false}
          >
            <DialogTitle className='sr-only'>Event Map</DialogTitle>
            <div className='flex items-center justify-between border-b px-4 py-2'>
              <div className='flex items-center gap-2'>
                <Map className='text-primary h-4 w-4' />
                <span className='text-sm font-semibold'>Event Map</span>
              </div>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8'
                onClick={() => setOpen(false)}
                aria-label='Close map'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
            <div className='flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4'>
              <img
                src={layoutImageUrl}
                alt='Event map fullscreen'
                className='max-h-full max-w-full object-contain'
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
