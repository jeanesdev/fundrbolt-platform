/**
 * BidderNumberBadge Component (T078)
 *
 * Display user's bidder number with check-in gating:
 * - Shows bidder number if user is checked in
 * - Shows "Check in at event" message if not checked in
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Info } from 'lucide-react';

interface BidderNumberBadgeProps {
  bidderNumber: number | null;
  isCheckedIn: boolean;
}

export function BidderNumberBadge({
  bidderNumber,
  isCheckedIn,
}: BidderNumberBadgeProps) {
  // If checked in and has bidder number, show it prominently
  if (isCheckedIn && bidderNumber) {
    return (
      <div className="flex items-center gap-3">
        <CheckCircle2
          className="h-5 w-5"
          style={{ color: 'rgb(var(--event-primary, 59, 130, 246))' }}
        />
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--event-card-text-muted, #D1D5DB)' }}
          >
            Your Bidder Number
          </p>
          <Badge
            variant="default"
            className="text-lg font-bold px-4 py-1 mt-1"
            style={{
              backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
              color: 'var(--event-text-on-primary, #FFFFFF)',
            }}
          >
            #{bidderNumber}
          </Badge>
        </div>
      </div>
    );
  }

  // If not checked in, show informational message
  return (
    <Alert
      className="border"
      style={{
        backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
        borderColor: 'rgb(var(--event-primary, 59, 130, 246) / 0.25)',
        color: 'var(--event-text-on-background, #000000)',
      }}
    >
      <Info className="h-4 w-4" />
      <AlertDescription>
        Check in at the event to see your bidder number.
      </AlertDescription>
    </Alert>
  );
}
