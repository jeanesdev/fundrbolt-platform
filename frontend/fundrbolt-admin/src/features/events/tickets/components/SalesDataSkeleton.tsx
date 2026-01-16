/**
 * Sales Data Loading Skeleton
 * Shows animated placeholders while sales data is loading
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SalesSummarySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PurchasersListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-5 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PackageSalesDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
      <PurchasersListSkeleton />
    </div>
  );
}

export function SalesExportSkeleton() {
  return <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>;
}
