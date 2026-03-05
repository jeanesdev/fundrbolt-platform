/**
 * AuctionItemEditPage
 * Page for editing an existing auction item
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuctionItemForm } from '@/features/events/components/AuctionItemForm';
import { useEventWorkspace } from '@/features/events/useEventWorkspace';
import { useAuctionItemStore } from '@/stores/auctionItemStore';
import type { AuctionItemUpdate } from '@/types/auction-item';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function AuctionItemEditPage() {
  const navigate = useNavigate();
  const { currentEvent } = useEventWorkspace();
  const { eventId: routeEventId, itemId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/$itemId/edit',
  });
  // Use real UUID for API calls, keep route param for navigation
  const eventId = currentEvent.id;

  const {
    selectedItem,
    isLoading,
    getAuctionItem,
    updateAuctionItem,
    clearSelectedItem,
  } = useAuctionItemStore();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load item on mount
  useEffect(() => {
    getAuctionItem(eventId, itemId).catch((err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load auction item'
      );
      navigate({ to: '/events/$eventId', params: { eventId: routeEventId }, search: { tab: 'auction-items' } });
    });

    // Cleanup on unmount
    return () => {
      clearSelectedItem();
    };
  }, [eventId, itemId, getAuctionItem, clearSelectedItem, navigate, routeEventId]);

  const handleSubmit = async (data: AuctionItemUpdate) => {
    setIsSubmitting(true);
    try {
      await updateAuctionItem(eventId, itemId, data);
      toast.success('Auction item updated successfully!');
      navigate({
        to: '/events/$eventId',
        params: { eventId: routeEventId },
        search: { tab: 'auction-items' },
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update auction item';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate({ to: '/events/$eventId', params: { eventId: routeEventId }, search: { tab: 'auction-items' } });
  };

  if (isLoading || !selectedItem) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="mb-4 md:mb-6 space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="mb-4 md:mb-6 space-y-4">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="px-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Auction Items
        </Button>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Edit Auction Item</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
            Update item details
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Make changes to the auction item below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemForm
            item={selectedItem}
            eventId={eventId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
