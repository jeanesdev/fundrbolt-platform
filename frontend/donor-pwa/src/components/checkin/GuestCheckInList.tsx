/**
 * GuestCheckInList Component
 * Displays list of guests with individual check-in buttons
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkinApi, type RegistrationGuest } from '@/lib/api/checkin'
import { CheckCircle2, Circle, User } from 'lucide-react'
import { useState } from 'react'

interface GuestCheckInListProps {
  guests: RegistrationGuest[]
  onGuestUpdated: () => void
}

export function GuestCheckInList({ guests, onGuestUpdated }: GuestCheckInListProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckIn = async (guestId: string) => {
    setLoading(guestId)
    try {
      await checkinApi.checkInGuest(guestId)
      onGuestUpdated()
    } catch (error) {
      console.error('Error checking in guest:', error)
    } finally {
      setLoading(null)
    }
  }

  const handleUndoCheckIn = async (guestId: string) => {
    setLoading(guestId)
    try {
      await checkinApi.undoCheckInGuest(guestId)
      onGuestUpdated()
    } catch (error) {
      console.error('Error undoing check-in:', error)
    } finally {
      setLoading(null)
    }
  }

  if (guests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Guests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No guests added to this registration</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guests ({guests.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {guests.map((guest) => (
            <div
              key={guest.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">
                    {guest.name || 'Guest (No Name Provided)'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {guest.email || 'No email provided'}
                  </div>
                  {guest.phone && (
                    <div className="text-sm text-muted-foreground">{guest.phone}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {guest.checked_in ? (
                  <>
                    <Badge variant="default" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Checked In
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndoCheckIn(guest.id)}
                      disabled={loading === guest.id}
                    >
                      {loading === guest.id ? 'Undoing...' : 'Undo'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Circle className="h-3 w-3" />
                      Not Checked In
                    </Badge>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleCheckIn(guest.id)}
                      disabled={loading === guest.id}
                    >
                      {loading === guest.id ? 'Checking In...' : 'Check In'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
