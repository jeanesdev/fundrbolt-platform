/**
 * Sales Summary Card Component
 * Displays event-wide ticket sales statistics
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  DollarSign,
  Package,
  TrendingUp,
} from 'lucide-react'
import { salesTrackingApi } from '@/api/salesTracking'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { SalesSummarySkeleton } from './SalesDataSkeleton'

interface SalesSummaryCardProps {
  eventId: string
}

export function SalesSummaryCard({ eventId }: SalesSummaryCardProps) {
  const [sponsorshipsOnly, setSponsorshipsOnly] = useState(false)
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sales-summary', eventId, sponsorshipsOnly],
    queryFn: () =>
      salesTrackingApi.getEventSalesSummary(eventId, sponsorshipsOnly),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  if (isLoading) {
    return <SalesSummarySkeleton />
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-destructive flex items-center'>
            <AlertCircle className='mr-2 h-4 w-4' />
            <span>Failed to load sales data</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span>Sales Overview</span>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground text-xs'>
                Sponsorships only
              </span>
              <Switch
                checked={sponsorshipsOnly}
                onCheckedChange={setSponsorshipsOnly}
              />
            </div>
            <Badge variant='outline' className='text-xs'>
              Live
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Total Revenue */}
        <div className='flex items-center justify-between rounded-lg border bg-green-50 p-4'>
          <div className='flex items-center gap-3'>
            <div className='rounded-full bg-green-100 p-2'>
              <DollarSign className='h-5 w-5 text-green-600' />
            </div>
            <div>
              <p className='text-muted-foreground text-sm'>Total Revenue</p>
              <p className='text-2xl font-bold text-green-700'>
                $
                {Number(summary.total_revenue).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Tickets Sold */}
        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div className='flex items-center gap-3'>
            <div className='rounded-full bg-blue-100 p-2'>
              <TrendingUp className='h-5 w-5 text-blue-600' />
            </div>
            <div>
              <p className='text-muted-foreground text-sm'>Tickets Sold</p>
              <p className='text-2xl font-bold'>{summary.total_tickets_sold}</p>
            </div>
          </div>
        </div>

        {/* Package Statistics */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='flex items-center gap-2 rounded-lg border p-3'>
            <Package className='text-muted-foreground h-4 w-4' />
            <div>
              <p className='text-muted-foreground text-xs'>Packages</p>
              <p className='text-lg font-semibold'>
                {summary.total_packages_sold}
              </p>
            </div>
          </div>

          {summary.packages_sold_out_count > 0 && (
            <div className='flex items-center gap-2 rounded-lg border bg-amber-50 p-3'>
              <AlertTriangle className='h-4 w-4 text-amber-600' />
              <div>
                <p className='text-muted-foreground text-xs'>Sold Out</p>
                <p className='text-lg font-semibold text-amber-700'>
                  {summary.packages_sold_out_count}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
