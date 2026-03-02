/**
 * WatchListButton - Toggle button for adding/removing items from watch list
 *
 * Features:
 * - Heart icon toggle
 * - Shows "watching" state visually
 * - Optimistic updates with error rollback
 * - Event branding support
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import watchListService from '@/services/watchlistService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface WatchListButtonProps {
  eventId: string;
  itemId: string;
  isWatching: boolean;
  onToggle?: (isWatching: boolean) => void;
  variant?: 'default' | 'icon';
  className?: string;
}

/**
 * WatchListButton component
 */
export function WatchListButton({
  eventId,
  itemId,
  isWatching: initialIsWatching,
  onToggle,
  variant = 'icon',
  className,
}: WatchListButtonProps) {
  const queryClient = useQueryClient();

  // Add to watch list mutation
  const addMutation = useMutation({
    mutationFn: () => watchListService.addToWatchList(eventId, itemId),
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['watchlist', eventId] });
      const previousData = queryClient.getQueryData(['watchlist', eventId]);
      onToggle?.(true);
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', eventId] });
      queryClient.invalidateQueries({ queryKey: ['auction-items', eventId] });
      toast.success('Added to watch list');
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['watchlist', eventId], context.previousData);
      }
      onToggle?.(false);
      toast.error('Failed to add to watch list');
    },
  });

  // Remove from watch list mutation
  const removeMutation = useMutation({
    mutationFn: () => watchListService.removeFromWatchList(eventId, itemId),
    onMutate: async () => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['watchlist', eventId] });
      const previousData = queryClient.getQueryData(['watchlist', eventId]);
      onToggle?.(false);
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', eventId] });
      queryClient.invalidateQueries({ queryKey: ['auction-items', eventId] });
      toast.success('Removed from watch list');
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['watchlist', eventId], context.previousData);
      }
      onToggle?.(true);
      toast.error('Failed to remove from watch list');
    },
  });

  const isLoading = addMutation.isPending || removeMutation.isPending;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click handlers
    if (isLoading) return;

    if (initialIsWatching) {
      removeMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={cn(
          'rounded-full p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          initialIsWatching
            ? 'bg-red-100 hover:bg-red-200'
            : 'bg-gray-100 hover:bg-gray-200',
          className
        )}
        aria-label={initialIsWatching ? 'Remove from watch list' : 'Add to watch list'}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
        ) : (
          <Heart
            className={cn('h-5 w-5 transition-colors', initialIsWatching ? 'fill-red-500 text-red-500' : 'text-gray-600')}
          />
        )}
      </button>
    );
  }

  return (
    <Button
      onClick={handleToggle}
      disabled={isLoading}
      variant={initialIsWatching ? 'default' : 'outline'}
      size="sm"
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Heart
          className={cn('h-4 w-4 mr-2', initialIsWatching && 'fill-current')}
        />
      )}
      {initialIsWatching ? 'Watching' : 'Watch'}
    </Button>
  );
}

export default WatchListButton;
