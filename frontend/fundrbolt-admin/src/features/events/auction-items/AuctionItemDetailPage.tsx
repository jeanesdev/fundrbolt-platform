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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BuyNowEditor } from '@/features/events/auction-items/components/BuyNowEditor';
import { EngagementPanel } from '@/features/events/auction-items/components/EngagementPanel';
import { PromotionEditor } from '@/features/events/auction-items/components/PromotionEditor';
import { useAuctionItemStore } from '@/stores/auctionItemStore';
import { AuctionType, ItemStatus } from '@/types/auction-item';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, DollarSign, ExternalLink, Pencil, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
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

  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [buyNowDialogOpen, setBuyNowDialogOpen] = useState(false);

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
    <div className="container mx-auto py-4 md:py-8 max-w-6xl">
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPromotionDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Promotion
            </Button>
            <Button variant="outline" onClick={() => setBuyNowDialogOpen(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Buy-Now
            </Button>
            <Button onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
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

      {/* Tabbed Interface */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Item Details</TabsTrigger>
          <TabsTrigger value="engagement">
            <TrendingUp className="h-4 w-4 mr-2" />
            Engagement
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{selectedItem.description}</p>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
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
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="mt-6">
          <EngagementPanel eventId={eventId} itemId={itemId} />
        </TabsContent>
      </Tabs>

      {/* Promotion Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="max-w-2xl">
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
        <DialogContent className="max-w-2xl">
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
  );
}
