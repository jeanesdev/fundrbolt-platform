/**
 * EngagementPanel Component
 * Displays auction item engagement data with tabs for Watchers, Views, and Bids
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auctionEngagementService } from '@/services/auctionEngagementService';
import type { AdminEngagementResponse } from '@/types/auction-engagement';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  DollarSign,
  Eye,
  Heart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface EngagementPanelProps {
  eventId: string;
  itemId: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
};

const formatDateTime = (dateStr: string): string => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

type SortField = 'name' | 'date' | 'amount' | 'duration';
type SortOrder = 'asc' | 'desc';

export function EngagementPanel({ eventId, itemId }: EngagementPanelProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data, isLoading, error } = useQuery<AdminEngagementResponse>({
    queryKey: ['auction-engagement', eventId, itemId],
    queryFn: () => auctionEngagementService.getEngagement(eventId, itemId),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedWatchers = useMemo(() => {
    if (!data?.watchers) return [];
    const sorted = [...data.watchers];
    sorted.sort((a, b) => {
      if (sortField === 'name') {
        const comparison = a.user.name.localeCompare(b.user.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      if (sortField === 'date') {
        const comparison = new Date(a.watching_since).getTime() - new Date(b.watching_since).getTime();
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return sorted;
  }, [data?.watchers, sortField, sortOrder]);

  const sortedViews = useMemo(() => {
    if (!data?.views) return [];
    const sorted = [...data.views];
    sorted.sort((a, b) => {
      if (sortField === 'name') {
        const comparison = a.user.name.localeCompare(b.user.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      if (sortField === 'duration') {
        const comparison = a.total_duration_seconds - b.total_duration_seconds;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      if (sortField === 'date') {
        const comparison = new Date(a.last_viewed_at).getTime() - new Date(b.last_viewed_at).getTime();
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return sorted;
  }, [data?.views, sortField, sortOrder]);

  const sortedBids = useMemo(() => {
    if (!data?.bids) return [];
    const sorted = [...data.bids];
    sorted.sort((a, b) => {
      if (sortField === 'name') {
        const comparison = a.user.name.localeCompare(b.user.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      if (sortField === 'amount') {
        const comparison = a.amount - b.amount;
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      if (sortField === 'date') {
        const comparison = new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return sorted;
  }, [data?.bids, sortField, sortOrder]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-center">
            Failed to load engagement data. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Watchers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_watchers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_views}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.unique_viewers} unique viewers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              View Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.summary.total_view_duration_seconds)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Bids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_bids}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Interface */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="watchers" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="watchers">
                Watchers ({data.watchers.length})
              </TabsTrigger>
              <TabsTrigger value="views">
                Views ({data.views.length})
              </TabsTrigger>
              <TabsTrigger value="bids">
                Bids ({data.bids.length})
              </TabsTrigger>
            </TabsList>

            {/* Watchers Tab */}
            <TabsContent value="watchers" className="mt-4">
              {sortedWatchers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No watchers yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Name
                            {sortField === 'name' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-1">
                            Watching Since
                            {sortField === 'date' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedWatchers.map((watcher) => (
                        <TableRow key={watcher.user.id}>
                          <TableCell className="font-medium">
                            {watcher.user.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {watcher.user.email}
                          </TableCell>
                          <TableCell>
                            {formatDate(watcher.watching_since)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Views Tab */}
            <TabsContent value="views" className="mt-4">
              {sortedViews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No views yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Name
                            {sortField === 'name' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('duration')}
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Total Duration
                            {sortField === 'duration' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-1">
                            Last Viewed
                            {sortField === 'date' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedViews.map((view) => (
                        <TableRow key={view.user.id}>
                          <TableCell className="font-medium">
                            {view.user.name}
                          </TableCell>
                          <TableCell>
                            {formatDuration(view.total_duration_seconds)}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(view.last_viewed_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Bids Tab */}
            <TabsContent value="bids" className="mt-4">
              {sortedBids.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No bids yet</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Bidder
                            {sortField === 'name' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            Amount
                            {sortField === 'amount' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-1">
                            Placed At
                            {sortField === 'date' && (
                              <span className="text-xs">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBids.map((bid) => (
                        <TableRow key={bid.id}>
                          <TableCell className="font-medium">
                            {bid.user.name}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(bid.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                bid.bid_type === 'max_bid' ? 'default' : 'secondary'
                              }
                            >
                              {bid.bid_type === 'max_bid' ? 'Max Bid' : 'Regular'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(bid.placed_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
