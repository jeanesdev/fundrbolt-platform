/**
 * TablemateCard Component (T079)
 *
 * Display card for a single tablemate showing:
 * - Name
 * - Bidder number (if checked in)
 * - Company (optional)
 * - Profile image (optional)
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { User } from 'lucide-react';

interface TablemateCardProps {
  name: string | null;
  bidderNumber: number | null;
  company?: string | null;
  profileImageUrl?: string | null;
}

export function TablemateCard({
  name,
  bidderNumber,
  company,
  profileImageUrl,
}: TablemateCardProps) {
  // Extract initials from name for avatar fallback
  const initials = name
    ? name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : '?';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12">
            {profileImageUrl && <AvatarImage src={profileImageUrl} alt={name || 'Guest'} />}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Guest Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{name || 'Guest'}</p>
              {bidderNumber && (
                <Badge variant="secondary" className="shrink-0">
                  #{bidderNumber}
                </Badge>
              )}
            </div>
            {company && (
              <p className="text-xs text-muted-foreground truncate">{company}</p>
            )}
            {!bidderNumber && (
              <p className="text-xs text-muted-foreground italic">Not checked in</p>
            )}
          </div>

          {/* User icon for visual consistency */}
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
