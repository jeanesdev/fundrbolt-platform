/**
 * Auctioneer (Event Coordinator) Dashboard
 *
 * Displayed to users with event_coordinator role.
 * Provides event management and auction oversight capabilities.
 *
 * Features (placeholder):
 * - Assigned events
 * - Auction items overview
 * - Bidding activity
 * - Event performance
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export function AuctioneerDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Auctioneer Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.first_name}! Manage your events and auctions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Events</CardTitle>
            <CardDescription>Events you're coordinating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Active assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auction Items</CardTitle>
            <CardDescription>Items across your events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total items listed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Bids</CardTitle>
            <CardDescription>Current bidding activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Bids placed today
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common event coordinator tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="text-sm text-muted-foreground">• Manage my events</p>
            <p className="text-sm text-muted-foreground">• Add auction items</p>
            <p className="text-sm text-muted-foreground">• View NPOs (read-only)</p>
            <p className="text-sm text-muted-foreground">• Monitor bidding</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
