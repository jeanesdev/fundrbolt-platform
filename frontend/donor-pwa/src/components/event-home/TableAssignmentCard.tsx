/**
 * TableAssignmentCard Component (T061)
 *
 * Displays table assignment details with customization:
 * - Table number
 * - Custom table name (if set by admin)
 * - Table occupancy
 */

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MapPin, Users } from 'lucide-react';

interface TableAssignmentCardProps {
  tableNumber: number;
  tableName: string | null;
  currentOccupancy: number;
  maxCapacity: number;
}

export function TableAssignmentCard({
  tableNumber,
  tableName,
  currentOccupancy,
  maxCapacity,
}: TableAssignmentCardProps) {
  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="space-y-3">
        {/* Table Number and Name */}
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-lg font-semibold px-4 py-1">
                Table {tableNumber}
              </Badge>
              {tableName && (
                <span className="text-base font-medium text-muted-foreground">
                  "{tableName}"
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Occupancy */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>
            {currentOccupancy} of {maxCapacity} seats filled
          </span>
        </div>
      </div>
    </Card>
  );
}
