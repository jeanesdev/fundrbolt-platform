/**
 * NPO Admin Dashboard
 * 
 * Displayed to users with npo_admin role.
 * Provides NPO-specific overview and management capabilities.
 * 
 * Features (placeholder):
 * - NPO statistics
 * - Events overview
 * - Team members
 * - Recent activity
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export function NpoAdminDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">NPO Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.first_name}! Manage your organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Your fundraising events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Active and upcoming
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Your staff and coordinators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Active team members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Donors</CardTitle>
            <CardDescription>Registered donors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total registered
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for NPO management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="text-sm text-muted-foreground">• Create new event</p>
            <p className="text-sm text-muted-foreground">• Invite team members</p>
            <p className="text-sm text-muted-foreground">• Manage NPO profile</p>
            <p className="text-sm text-muted-foreground">• View reports</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
