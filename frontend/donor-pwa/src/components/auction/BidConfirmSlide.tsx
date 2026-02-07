/**
 * BidConfirmSlide - Swipe-to-confirm component for bid confirmation
 *
 * Features:
 * - Horizontal slider requiring slide gesture to confirm
 * - Shows bid amount and type (regular or max bid)
 * - Visual feedback for slide progress
 * - Event branding support
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface BidConfirmSlideProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bidAmount: number;
  isMaxBid?: boolean;
  itemTitle: string;
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
 * BidConfirmSlide component
 */
export function BidConfirmSlide({
  isOpen,
  onClose,
  onConfirm,
  bidAmount,
  isMaxBid = false,
  itemTitle,
}: BidConfirmSlideProps) {
  const [sliderValue, setSliderValue] = useState<number[]>([0]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const slidePercent = sliderValue[0] ?? 0;
  const isComplete = slidePercent >= 95; // 95% threshold for confirmation

  // Reset slider when modal opens
  useEffect(() => {
    if (isOpen) {
      setSliderValue([0]);
      setIsConfirmed(false);
    }
  }, [isOpen]);

  // Auto-confirm when slider reaches end
  useEffect(() => {
    if (isComplete && !isConfirmed) {
      setIsConfirmed(true);
      // Short delay for visual feedback before confirming
      setTimeout(() => {
        onConfirm();
      }, 300);
    }
  }, [isComplete, isConfirmed, onConfirm]);

  const handleSliderChange = (value: number[]) => {
    // Prevent sliding back once complete
    if (!isConfirmed) {
      setSliderValue(value);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent
        className="max-w-md"
        style={{ backgroundColor: 'rgb(var(--event-background, 255, 255, 255))' }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-xl font-bold text-center"
            style={{ color: 'var(--event-text-on-background, #000000)' }}
          >
            Confirm Your Bid
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-center line-clamp-2"
            style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
          >
            {itemTitle}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Bid summary */}
          <div
            className="rounded-lg p-6 text-center"
            style={{ backgroundColor: 'rgb(var(--event-card-bg, 147, 51, 234))' }}
          >
            <div
              className="text-sm font-medium mb-2"
              style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
            >
              {isMaxBid ? 'Maximum Bid Amount' : 'Bid Amount'}
            </div>
            <div
              className="text-4xl font-bold mb-2"
              style={{ color: 'var(--event-card-text, #000000)' }}
            >
              {formatCurrency(bidAmount)}
            </div>
            {isMaxBid && (
              <div
                className="text-xs"
                style={{ color: 'var(--event-card-text-muted, #6B7280)' }}
              >
                Auto-bid up to this amount
              </div>
            )}
          </div>

          {/* Swipe-to-confirm slider */}
          <div className="space-y-2">
            <div
              className="text-sm font-medium text-center"
              style={{ color: 'var(--event-text-on-background, #000000)' }}
            >
              Slide to Confirm
            </div>

            <div className="relative">
              {/* Slider track background with gradient */}
              <div
                className={cn(
                  'relative rounded-full p-1 transition-all duration-300',
                  isComplete ? 'opacity-100' : 'opacity-90'
                )}
                style={{
                  background: isComplete
                    ? 'rgb(34, 197, 94)' // green when complete
                    : `linear-gradient(to right, 
                        rgb(var(--event-primary, 59, 130, 246)) 0%, 
                        rgb(var(--event-primary, 59, 130, 246)) ${slidePercent}%, 
                        rgb(229, 231, 235) ${slidePercent}%, 
                        rgb(229, 231, 235) 100%)`,
                }}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  {/* Left icon */}
                  <div
                    className={cn(
                      'transition-opacity duration-300',
                      slidePercent > 30 ? 'opacity-0' : 'opacity-100'
                    )}
                  >
                    <ArrowRight
                      className="h-5 w-5"
                      style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                    />
                  </div>

                  {/* Center text */}
                  <div
                    className="text-sm font-medium"
                    style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                  >
                    {isComplete ? 'Confirmed!' : 'Slide to Confirm'}
                  </div>

                  {/* Right icon */}
                  <div
                    className={cn(
                      'transition-opacity duration-300',
                      isComplete ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    <Check
                      className="h-5 w-5"
                      style={{ color: 'var(--event-text-on-primary, #FFFFFF)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Invisible slider overlay */}
              <div className="absolute inset-0 flex items-center">
                <Slider
                  value={sliderValue}
                  onValueChange={handleSliderChange}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full opacity-0 cursor-grab active:cursor-grabbing"
                  aria-label="Slide to confirm bid"
                  disabled={isConfirmed}
                />
              </div>
            </div>

            <div
              className="text-xs text-center"
              style={{ color: 'var(--event-text-muted-on-background, #6B7280)' }}
            >
              {isMaxBid
                ? 'Slide to confirm your maximum bid'
                : 'Slide to confirm and place your bid'}
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default BidConfirmSlide;
