/**
 * Sales Summary Card Component
 * Displays event-wide ticket sales statistics
 */

import { salesTrackingApi } from '@/api/salesTracking';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, DollarSign, Package, TrendingUp } from 'lucide-react';

interface SalesSummaryCardProps {
  eventId: string;
}

export function SalesSummaryCard({ eventId }: SalesSummaryCardProps) {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['sales-summary', eventId],
    queryFn: () => salesTrackingApi.getEventSalesSummary(eventId),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sales Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-destructive">
            <AlertCircle className="mr-2 h-4 w-4" />
            <span>Failed to load sales data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Sales Overview</span>
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Revenue */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-green-700">
                ${Number(summary.total_revenue).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Tickets Sold */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tickets Sold</p>
              <p className="text-2xl font-bold">{summary.total_tickets_sold}</p>
            </div>
          </div>
        </div>

        {/* Package Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Packages</p>
              <p className="text-lg font-semibold">{summary.total_packages_sold}</p>
            </div>
          </div>

          {summary.packages_sold_out_count > 0 && (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Sold Out</p>
                <p className="text-lg font-semibold text-amber-700">
                  {summary.packages_sold_out_count}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
