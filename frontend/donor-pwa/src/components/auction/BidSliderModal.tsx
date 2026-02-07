/**
 * BidSliderModal - Modal for selecting bid amount with vertical slider
 *
 * Features:
 * - Vertical slider showing minimum bid at bottom, higher amounts upward
 * - "Place Bid" and "Set as Max Bid" buttons (hide max bid if not allowed)
 * - Shows current high bid and minimum required bid
 * - Event branding support
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { DollarSign, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface BidSliderModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTitle: string;
  currentBid: number;
  minNextBid: number;
  bidIncrement: number;
  allowMaxBid?: boolean;
  onPlaceBid: (amount: number) => void;
  onSetMaxBid?: (amount: number) => void;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * BidSliderModal component
 */
export function BidSliderModal({
  isOpen,
  onClose,
  itemTitle,
  currentBid,
  minNextBid,
  bidIncrement,
  allowMaxBid = true,
  onPlaceBid,
  onSetMaxBid,
}: BidSliderModalProps) {
  // Calculate slider range: 10 increments above minimum
  const maxSliderAmount = minNextBid + bidIncrement * 10;
  const [sliderValue, setSliderValue] = useState<number[]>([minNextBid]);
  const selectedAmount = sliderValue[0] ?? minNextBid;

  // Reset slider when modal opens or values change
  useEffect(() => {
    if (isOpen) {
      setSliderValue([minNextBid]);
    }
  }, [isOpen, minNextBid]);

  const handlePlaceBid = () => {
    onPlaceBid(selectedAmount);
  };

  const handleSetMaxBid = () => {
    if (onSetMaxBid) {
      onSetMaxBid(selectedAmount);
    }
  };

  // Calculate slider position percentage (inverted for vertical display)
  const sliderPercent = ((selectedAmount - minNextBid) / (maxSliderAmount - minNextBid)) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md"
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-xl font-bold"
            style={{ color: 'var(--event-text-on-background, #000000)' }}
          >
            Place Your Bid
          </DialogTitle>
          <DialogDescription
            className="line-clamp-2"
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          >
            {itemTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current bid info */}
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))' }}
          >
            <div className="flex justify-between items-center mb-2">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
              >
                Current High Bid
              </span>
              <span
                className="text-xl font-bold"
                style={{ color: 'var(--event-card-text, #000000)' }}
              >
                {formatCurrency(currentBid)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
              >
                Minimum Next Bid
              </span>
              <span
                className="text-base font-semibold"
                style={{ color: 'var(--event-card-text, #000000)' }}
              >
                {formatCurrency(minNextBid)}
              </span>
            </div>
          </div>

          {/* Vertical slider section */}
          <div className="flex items-center gap-6">
            {/* Vertical slider */}
            <div className="relative flex flex-col items-center h-80">
              {/* Amount display above slider */}
              <div
                className="mb-4 rounded-lg px-4 py-3 text-center min-w-[120px]"
                style={{ backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))' }}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                >
                  Your Bid
                </div>
                <div
                  className="text-2xl font-bold"
                  style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                >
                  {formatCurrency(selectedAmount)}
                </div>
              </div>

              {/* Slider track */}
              <Slider
                value={sliderValue}
                onValueChange={setSliderValue}
                min={minNextBid}
                max={maxSliderAmount}
                step={bidIncrement}
                orientation="vertical"
                className="h-full"
                aria-label="Bid amount"
              />

              {/* Min/Max labels */}
              <div className="mt-4 space-y-2 text-center">
                <div
                  className="text-xs"
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                >
                  Min: {formatCurrency(minNextBid)}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
                >
                  Max: {formatCurrency(maxSliderAmount)}
                </div>
              </div>
            </div>

            {/* Increment guide */}
            <div className="flex-1 space-y-3">
              <div
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--event-text-on-background, #000000)' }}
              >
                Quick Select
              </div>
              {[0, 1, 2, 3, 4].map((multiplier) => {
                const amount = minNextBid + bidIncrement * multiplier;
                if (amount > maxSliderAmount) return null;
                return (
                  <button
                    key={multiplier}
                    onClick={() => setSliderValue([amount])}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:opacity-80 border',
                      selectedAmount === amount ? 'border-2' : 'border-transparent'
                    )}
                    style={
                      selectedAmount === amount
                        ? {
                            backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                            color: 'var(--event-text-on-primary, #FFFFFF)',
                            borderColor: 'rgb(var(--event-accent, 147, 51, 234))',
                          }
                        : {
                            backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))',
                            color: 'var(--event-card-text, #000000)',
                          }
                    }
                  >
                    {formatCurrency(amount)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              onClick={handlePlaceBid}
              className="w-full"
              size="lg"
              style={{
                backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
                color: 'var(--event-text-on-primary, #FFFFFF)',
              }}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Place Bid - {formatCurrency(selectedAmount)}
            </Button>

            {allowMaxBid && onSetMaxBid && (
              <Button
                onClick={handleSetMaxBid}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Set as Max Bid - {formatCurrency(selectedAmount)}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BidSliderModal;
