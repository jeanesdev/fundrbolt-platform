/**
 * Event (Staff) Dashboard
 * 
 * Displayed to users with staff role.
 * Provides event check-in and donor management capabilities.
 * 
 * Features (placeholder):
 * - Assigned events
 * - Donor check-in
 * - Event attendance
 * - Quick actions
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export function EventDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Event Staff Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.first_name}! Manage event operations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Events</CardTitle>
            <CardDescription>Events you're assigned to</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Active events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checked In</CardTitle>
            <CardDescription>Donors checked in today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Today's attendance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered Donors</CardTitle>
            <CardDescription>For your events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total registrations
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common staff tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="text-sm text-muted-foreground">• Check in donors</p>
            <p className="text-sm text-muted-foreground">• View my events</p>
            <p className="text-sm text-muted-foreground">• View NPO (read-only)</p>
            <p className="text-sm text-muted-foreground">• View donors (read-only)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
