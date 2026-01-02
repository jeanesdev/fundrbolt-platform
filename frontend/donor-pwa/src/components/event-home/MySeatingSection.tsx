/**
 * MySeatingSection Component (T077)
 *
 * Collapsible section displaying user's seating information:
 * - Table number
 * - Bidder number (if checked in)
 * - List of tablemates
 * - Pending assignment message if no table
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { BidderNumberBadge } from './BidderNumberBadge';
import { TableAssignmentCard } from './TableAssignmentCard';
import { TableCaptainBadge } from './TableCaptainBadge';
import { TablemateCard } from './TablemateCard';

interface MySeatingInfo {
  guestId: string;
  fullName: string | null;
  bidderNumber: number | null;
  tableNumber: number | null;
  checkedIn: boolean;
}

interface TablemateInfo {
  guestId: string;
  name: string | null;
  bidderNumber: number | null;
  company?: string | null;
  profileImageUrl?: string | null;
}

interface TableAssignment {
  tableNumber: number;
  tableName: string | null;
  captainFullName: string | null;
  youAreCaptain: boolean;
}

interface SeatingInfoResponse {
  myInfo: MySeatingInfo;
  tablemates: TablemateInfo[];
  tableCapacity: {
    current: number;
    max: number;
  };
  hasTableAssignment: boolean;
  message?: string | null;
  tableAssignment?: TableAssignment | null;
}

interface MySeatingProps {
  seatingInfo: SeatingInfoResponse;
}

export function MySeatingSection({ seatingInfo }: MySeatingProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { myInfo, tablemates, tableCapacity, hasTableAssignment, message, tableAssignment } = seatingInfo;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card>
        <CardHeader>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                My Seating
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Pending Assignment Message */}
            {!hasTableAssignment && message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* Table Assignment */}
            {hasTableAssignment && myInfo.tableNumber && (
              <div className="space-y-4">
                {/* Table Customization Details (T063-T067) */}
                {tableAssignment && (
                  <>
                    <TableAssignmentCard
                      tableNumber={tableAssignment.tableNumber}
                      tableName={tableAssignment.tableName}
                      currentOccupancy={tableCapacity.current}
                      maxCapacity={tableCapacity.max}
                    />
                    <TableCaptainBadge
                      captainFullName={tableAssignment.captainFullName}
                      youAreCaptain={tableAssignment.youAreCaptain}
                    />
                    <Separator />
                  </>
                )}

                {/* Fallback to basic table number if no customization (T068) */}
                {!tableAssignment && (
                  <>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Table Number</p>
                        <Badge variant="outline" className="text-lg font-semibold px-4 py-1 mt-1">
                          Table {myInfo.tableNumber}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Bidder Number */}
                <BidderNumberBadge
                  bidderNumber={myInfo.bidderNumber}
                  isCheckedIn={myInfo.checkedIn}
                />

                <Separator />

                {/* Tablemates */}
                {tablemates.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Your Tablemates</h3>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {tableCapacity.current}/{tableCapacity.max}
                      </Badge>
                    </div>

                    <div className="grid gap-2">
                      {tablemates.map((tablemate) => (
                        <TablemateCard
                          key={tablemate.guestId}
                          name={tablemate.name}
                          bidderNumber={tablemate.bidderNumber}
                          company={tablemate.company}
                          profileImageUrl={tablemate.profileImageUrl}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No Tablemates Yet */}
                {tablemates.length === 0 && (
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      You're the first at your table! More guests may be assigned soon.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
