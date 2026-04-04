/**
 * AuctionItemDetailLayout
 * Shared layout wrapper for auction item detail views (Details + Engagement).
 * Provides the header, status badges, action buttons, sub-navigation, and dialogs.
 */
import { type ReactNode, useEffect, useState } from 'react'
import {
  Link,
  useNavigate,
  useParams,
  useRouterState,
} from '@tanstack/react-router'
import { AuctionType, ItemStatus } from '@/types/auction-item'
import {
  ArrowLeft,
  DollarSign,
  Pencil,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuctionItemStore } from '@/stores/auctionItemStore'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { BuyNowEditor } from '@/features/events/auction-items/components/BuyNowEditor'
import { PromotionEditor } from '@/features/events/auction-items/components/PromotionEditor'
import { useEventWorkspace } from '@/features/events/useEventWorkspace'

const tabs = [
  {
    label: 'Item Details',
    to: '/events/$eventId/auction-items/$itemId' as const,
    exact: true,
  },
  {
    label: 'Engagement',
    to: '/events/$eventId/auction-items/$itemId/engagement' as const,
    icon: TrendingUp,
  },
]

interface AuctionItemDetailLayoutProps {
  children: ReactNode
}

export function AuctionItemDetailLayout({
  children,
}: AuctionItemDetailLayoutProps) {
  const navigate = useNavigate()
  const { currentEvent } = useEventWorkspace()
  const { eventId: rawRouteEventId, itemId } = useParams({
    strict: false,
  }) as {
    eventId?: string
    itemId: string
  }
  // Use real UUID for API calls, keep route param (or slug fallback) for navigation
  const eventId = currentEvent.id
  const routeEventId = rawRouteEventId || currentEvent.slug || currentEvent.id
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  })

  const { selectedItem, isLoading, getAuctionItem, clearSelectedItem } =
    useAuctionItemStore()

  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false)
  const [buyNowDialogOpen, setBuyNowDialogOpen] = useState(false)

  useEffect(() => {
    getAuctionItem(eventId, itemId).catch((err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load auction item'
      )
      navigate({
        to: '/events/$eventId',
        params: { eventId: routeEventId },
        search: { tab: 'auction-items' },
      })
    })

    return () => {
      clearSelectedItem()
    }
  }, [
    eventId,
    itemId,
    getAuctionItem,
    clearSelectedItem,
    navigate,
    routeEventId,
  ])

  const handleEdit = () => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId/edit',
      params: { eventId: routeEventId, itemId },
    })
  }

  const handleBack = () => {
    navigate({
      to: '/events/$eventId',
      params: { eventId: routeEventId },
      search: { tab: 'auction-items' },
    })
  }

  if (isLoading || !selectedItem) {
    return (
      <div className='space-y-4 md:space-y-6'>
        <div className='mb-4 space-y-4 md:mb-6'>
          <Skeleton className='h-10 w-40' />
          <Skeleton className='h-8 w-64' />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-32' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-4'>
            <Skeleton className='h-20 w-full' />
            <Skeleton className='h-20 w-full' />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-4 md:space-y-6'>
      <div className='mb-4 space-y-4 md:mb-6'>
        <Button
          variant='ghost'
          onClick={handleBack}
          className='px-0 hover:bg-transparent'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Auction Items
        </Button>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 flex-1'>
            <h1 className='text-2xl font-bold md:text-3xl'>
              {selectedItem.title}
            </h1>
            <p className='text-muted-foreground mt-1 text-sm md:text-base'>
              Bid #{selectedItem.bid_number}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPromotionDialogOpen(true)}
            >
              <Sparkles className='mr-1.5 h-4 w-4' />
              Promotion
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setBuyNowDialogOpen(true)}
            >
              <DollarSign className='mr-1.5 h-4 w-4' />
              Buy-Now
            </Button>
            <Button size='sm' onClick={handleEdit}>
              <Pencil className='mr-1.5 h-4 w-4' />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Status & Type */}
      <div className='mb-6 flex gap-2'>
        <Badge
          variant={
            selectedItem.status === ItemStatus.PUBLISHED
              ? 'default'
              : selectedItem.status === ItemStatus.DRAFT
                ? 'secondary'
                : selectedItem.status === ItemStatus.WITHDRAWN
                  ? 'destructive'
                  : 'outline'
          }
        >
          {selectedItem.status}
        </Badge>
        <Badge variant='outline'>
          {selectedItem.auction_type === AuctionType.LIVE ? 'Live' : 'Silent'}{' '}
          Auction
        </Badge>
      </div>

      {/* Sub-navigation */}
      <nav className='bg-muted/40 mb-6 flex gap-1 rounded-lg border p-1'>
        {tabs.map((tab) => {
          const href = tab.to
            .replace('$eventId', routeEventId)
            .replace('$itemId', itemId)
          const isActive = tab.exact
            ? pathname === href || pathname === `${href}/`
            : pathname.startsWith(href)

          return (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ eventId: routeEventId, itemId }}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )}
            >
              {tab.icon && <tab.icon className='h-4 w-4' />}
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Page content */}
      {children}

      {/* Promotion Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Edit Promotion</DialogTitle>
            <DialogDescription>
              Add or update promotion badge and notice for this auction item
            </DialogDescription>
          </DialogHeader>
          <PromotionEditor
            eventId={eventId}
            item={selectedItem}
            onCancel={() => setPromotionDialogOpen(false)}
            onSuccess={() => setPromotionDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Buy-Now Dialog */}
      <Dialog open={buyNowDialogOpen} onOpenChange={setBuyNowDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Buy-Now Settings</DialogTitle>
            <DialogDescription>
              Manage buy-now availability and quantity for this auction item
            </DialogDescription>
          </DialogHeader>
          <BuyNowEditor
            eventId={eventId}
            item={selectedItem}
            onCancel={() => setBuyNowDialogOpen(false)}
            onSuccess={() => setBuyNowDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
