/**
 * TableCaptainBadge Component (T062)
 *
 * Displays table captain information:
 * - "You are the Table Captain" if user is captain
 * - "Captain: [Name]" if someone else is captain
 * - Hidden if no captain assigned
 */

import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';

interface TableCaptainBadgeProps {
  captainFullName: string | null;
  youAreCaptain: boolean;
}

export function TableCaptainBadge({
  captainFullName,
  youAreCaptain,
}: TableCaptainBadgeProps) {
  // Don't render if no captain assigned
  if (!youAreCaptain && !captainFullName) {
    return null;
  }

  return (
    <Badge
      variant={youAreCaptain ? 'default' : 'secondary'}
      className="flex items-center gap-1.5 w-fit text-sm py-1.5 px-3"
      style={
        youAreCaptain
          ? {
            backgroundColor: 'rgb(var(--event-primary, 59, 130, 246))',
            color: 'var(--event-text-on-primary, #FFFFFF)',
          }
          : {
            backgroundColor: 'rgb(var(--event-background, 255, 255, 255))',
            color: 'var(--event-text-on-background, #000000)',
            border: '1px solid rgb(var(--event-primary, 59, 130, 246) / 0.25)',
          }
      }
    >
      <Crown className="h-4 w-4" />
      {youAreCaptain ? (
        <span>You are the Table Captain</span>
      ) : (
        <span>Captain: {captainFullName}</span>
      )}
    </Badge>
  );
}
