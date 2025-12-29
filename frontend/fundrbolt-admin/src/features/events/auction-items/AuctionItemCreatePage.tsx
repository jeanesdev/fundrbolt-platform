/**
 * AuctionItemCreatePage
 * Page for creating a new auction item
 */

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuctionItemForm } from '@/features/events/components/AuctionItemForm';
import { useAuctionItemStore } from '@/stores/auctionItemStore';
import type {
  AuctionItemCreate,
  AuctionItemUpdate,
} from '@/types/auction-item';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function AuctionItemCreatePage() {
  const navigate = useNavigate();
  const { eventId } = useParams({
    from: '/_authenticated/events/$eventId/auction-items/create',
  });

  const { createAuctionItem } = useAuctionItemStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    data: AuctionItemCreate | AuctionItemUpdate
  ) => {
    setIsSubmitting(true);
    try {
      const createdItem = await createAuctionItem(
        eventId,
        data as AuctionItemCreate
      );

      if (!createdItem?.id) {
        throw new Error('Item created but no ID returned from server');
      }

      toast.success('Auction item created successfully!');
      navigate({
        to: '/events/$eventId',
        params: { eventId },
        search: { tab: 'auction-items' },
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create auction item';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate({ to: '/events/$eventId', params: { eventId }, search: { tab: 'auction-items' } });
  };

  return (
    <div className="container mx-auto py-4 md:py-8 max-w-4xl">
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
          <h1 className="text-2xl md:text-3xl font-bold">
            Add Auction Item
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
            Create a new item for the auction
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>
            Fill out the information below to add a new auction item
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuctionItemForm
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
