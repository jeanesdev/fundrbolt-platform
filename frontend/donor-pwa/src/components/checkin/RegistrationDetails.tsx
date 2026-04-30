/**
 * RegistrationDetails Component
 * Displays registration information with check-in status
 */
import { format } from 'date-fns'
import { CheckCircle2, Clock } from 'lucide-react'
import type { EventRegistration } from '@/lib/api/checkin'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface RegistrationDetailsProps {
  registration: EventRegistration
}

export function RegistrationDetails({
  registration,
}: RegistrationDetailsProps) {
  const isCheckedIn = !!registration.check_in_time

  return (
    <Card>
      <CardHeader>
        <div className='flex items-start justify-between'>
          <div>
            <CardTitle>Registration Details</CardTitle>
            <CardDescription>
              Confirmation Code: {registration.id}
            </CardDescription>
          </div>
          {isCheckedIn ? (
            <Badge variant='default' className='flex items-center gap-1'>
              <CheckCircle2 className='h-3 w-3' />
              Checked In
            </Badge>
          ) : (
            <Badge variant='secondary' className='flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              Not Checked In
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <div className='text-muted-foreground text-sm font-medium'>
              Status
            </div>
            <div className='text-base font-semibold capitalize'>
              {registration.status}
            </div>
          </div>
          <div>
            <div className='text-muted-foreground text-sm font-medium'>
              Number of Guests
            </div>
            <div className='text-base font-semibold'>
              {registration.number_of_guests}
            </div>
          </div>
          {isCheckedIn && registration.check_in_time && (
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Check-In Time
              </div>
              <div className='text-base font-semibold'>
                {format(new Date(registration.check_in_time), 'PPp')}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
