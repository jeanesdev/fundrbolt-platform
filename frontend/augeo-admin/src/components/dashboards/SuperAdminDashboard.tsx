/**
 * SuperAdmin Dashboard
 * 
 * Displayed to users with super_admin role.
 * Provides platform-wide overview and management capabilities.
 * 
 * Features (placeholder):
 * - Platform-wide statistics
 * - All NPOs overview
 * - System health metrics
 * - Recent activity across all NPOs
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'

export function SuperAdminDashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SuperAdmin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.first_name}! You have full platform access.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total NPOs</CardTitle>
            <CardDescription>Active nonprofit organizations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Platform-wide statistics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Events</CardTitle>
            <CardDescription>Across all NPOs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              All fundraising events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Platform users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">--</div>
            <p className="text-xs text-muted-foreground mt-2">
              Administrators and donors
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="text-sm text-muted-foreground">• Manage all NPOs</p>
            <p className="text-sm text-muted-foreground">• View all events</p>
            <p className="text-sm text-muted-foreground">• Manage all users</p>
            <p className="text-sm text-muted-foreground">• System configuration</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
