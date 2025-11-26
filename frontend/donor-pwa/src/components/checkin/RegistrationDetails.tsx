/**
 * RegistrationDetails Component
 * Displays registration information with check-in status
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EventRegistration } from '@/lib/api/checkin'
import { format } from 'date-fns'
import { CheckCircle2, Clock } from 'lucide-react'

interface RegistrationDetailsProps {
  registration: EventRegistration
}

export function RegistrationDetails({ registration }: RegistrationDetailsProps) {
  const isCheckedIn = !!registration.check_in_time

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Registration Details</CardTitle>
            <CardDescription>
              Confirmation Code: {registration.id}
            </CardDescription>
          </div>
          {isCheckedIn ? (
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Checked In
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Not Checked In
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <div className="text-base font-semibold capitalize">{registration.status}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Number of Guests</div>
            <div className="text-base font-semibold">{registration.number_of_guests}</div>
          </div>
          {registration.ticket_type && (
            <div>
              <div className="text-sm font-medium text-muted-foreground">Ticket Type</div>
              <div className="text-base font-semibold">{registration.ticket_type}</div>
            </div>
          )}
          {isCheckedIn && registration.check_in_time && (
            <div>
              <div className="text-sm font-medium text-muted-foreground">Check-In Time</div>
              <div className="text-base font-semibold">
                {format(new Date(registration.check_in_time), 'PPp')}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
