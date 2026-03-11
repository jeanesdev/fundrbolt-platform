/**
 * Sales Data Loading Skeleton
 * Shows animated placeholders while sales data is loading
 */
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function SalesSummarySkeleton() {
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className='pb-3'>
            <div className='h-4 w-24 animate-pulse rounded bg-gray-200'></div>
          </CardHeader>
          <CardContent>
            <div className='mb-2 h-8 w-32 animate-pulse rounded bg-gray-200'></div>
            <div className='h-3 w-20 animate-pulse rounded bg-gray-200'></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function PurchasersListSkeleton() {
  return (
    <div className='space-y-2'>
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className='p-4'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center gap-2'>
                    <div className='h-4 w-4 animate-pulse rounded bg-gray-200'></div>
                    <div className='h-5 w-32 animate-pulse rounded bg-gray-200'></div>
                    <div className='h-5 w-16 animate-pulse rounded bg-gray-200'></div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='h-4 w-48 animate-pulse rounded bg-gray-200'></div>
                    <div className='h-4 w-20 animate-pulse rounded bg-gray-200'></div>
                    <div className='h-4 w-16 animate-pulse rounded bg-gray-200'></div>
                  </div>
                </div>
                <div className='h-8 w-8 animate-pulse rounded bg-gray-200'></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function PackageSalesDetailsSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='h-6 w-32 animate-pulse rounded bg-gray-200'></div>
      </div>
      <PurchasersListSkeleton />
    </div>
  )
}

export function SalesExportSkeleton() {
  return <div className='h-9 w-32 animate-pulse rounded bg-gray-200'></div>
}
