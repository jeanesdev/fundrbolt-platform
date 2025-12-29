/**
 * AuctionItemDetailPage
 * Page for viewing auction item details
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuctionItemStore } from '@/stores/auctionItemStore';
import { AuctionType, ItemStatus } from '@/types/auction-item';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';

const formatCurrency = (amount: number | null): string => {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function AuctionItemDetailPage() {
  const navigate = useNavigate();
  const { eventId, itemId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/$itemId/',
  });

  const { selectedItem, isLoading, getAuctionItem, clearSelectedItem } =
    useAuctionItemStore();

  useEffect(() => {
    getAuctionItem(eventId, itemId).catch((err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load auction item'
      );
      navigate({ to: '/events/$eventId', params: { eventId }, search: { tab: 'auction-items' } });
    });

    return () => {
      clearSelectedItem();
    };
  }, [eventId, itemId, getAuctionItem, clearSelectedItem, navigate]);

  const handleEdit = () => {
    navigate({
      to: '/events/$eventId/auction-items/$itemId/edit',
      params: { eventId, itemId },
    });
  };

  const handleBack = () => {
    navigate({ to: '/events/$eventId', params: { eventId }, search: { tab: 'auction-items' } });
  };

  if (isLoading || !selectedItem) {
    return (
      <div className="container mx-auto py-4 md:py-8 max-w-4xl">
        <div className="mb-4 md:mb-6 space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-4xl">
      <div className="mb-4 md:mb-6 space-y-4">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Auction Items
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">
              {selectedItem.title}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Bid #{selectedItem.bid_number}
            </p>
          </div>
          <Button onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Status & Type */}
      <div className="mb-6 flex gap-2">
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
        <Badge variant="outline">
          {selectedItem.auction_type === AuctionType.LIVE ? 'Live' : 'Silent'}{' '}
          Auction
        </Badge>
      </div>

      {/* Description */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{selectedItem.description}</p>
        </CardContent>
      </Card>

      {/* Pricing Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pricing Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Starting Bid</p>
              <p className="text-lg font-semibold">
                {formatCurrency(selectedItem.starting_bid)}
              </p>
            </div>

            {selectedItem.donor_value && (
              <div>
                <p className="text-sm text-muted-foreground">Donor Value</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(selectedItem.donor_value)}
                </p>
              </div>
            )}

            {selectedItem.cost && (
              <div>
                <p className="text-sm text-muted-foreground">Cost to NPO</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(selectedItem.cost)}
                </p>
              </div>
            )}

            {selectedItem.buy_now_price && selectedItem.buy_now_enabled && (
              <div>
                <p className="text-sm text-muted-foreground">Buy Now Price</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(selectedItem.buy_now_price)}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">
                Quantity Available
              </p>
              <p className="text-lg font-semibold">
                {selectedItem.quantity_available}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedItem.donated_by && (
              <div>
                <p className="text-sm text-muted-foreground">Donated By</p>
                <p className="font-medium">{selectedItem.donated_by}</p>
              </div>
            )}

            {selectedItem.item_webpage && (
              <div>
                <p className="text-sm text-muted-foreground">Item Webpage</p>
                <a
                  href={selectedItem.item_webpage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View Details
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {selectedItem.display_priority !== null &&
              selectedItem.display_priority !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Display Priority
                  </p>
                  <p className="font-medium">{selectedItem.display_priority}</p>
                </div>
              )}

            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(selectedItem.created_at).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">
                {new Date(selectedItem.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
